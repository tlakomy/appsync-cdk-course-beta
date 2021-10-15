- Create a CDK project
- Create a GraphQL schema

```graphql
type Book {
  id: ID!
  name: String!
  completed: Boolean!
}

type Query {
  getBookById(BookId: String!): Book
  listBooks: [Book]
}
```

- Create an AppSync API and deploy (without the authorizationConfig)

```ts
const api = new appsync.GraphqlApi(this, "Api", {
  name: "my-api",
  schema: appsync.Schema.fromAsset("graphql/schema.graphql"),
});
```

- Open GraphQL playground, try to send a request without x-api-key header
- Go to AWS Console, copy the API key, try again
- Add the API Key to CDK stack & deploy

```ts
authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY,
          apiKeyConfig: {
            description: "Default API Key for my app",
            name: "My API Key",
            expires: cdk.Expiration.after(cdk.Duration.days(365)),
          },
        },
      },
```

- Send a request again, notice the `null` response
- Add GraphQL API URL and API Key to cfnOutputs

```ts
new cdk.CfnOutput(this, "GraphQLAPIURL", {
  value: api.graphqlUrl,
});

new cdk.CfnOutput(this, "GraphQLAPIKey", {
  value: api.apiKey || "",
});
```

- Add a Lambda function and connect it as a data source (**consider using common params for all functions**). Convert a function to ARM architecture, let's goo.

```ts
const commonLambdaProps: Omit<lambda.FunctionProps, "handler"> = {
  runtime: lambda.Runtime.NODEJS_14_X,
  code: lambda.Code.fromAsset("functions"),
  memorySize: 1024,
  architectures: [lambda.Architecture.ARM_64],
  timeout: cdk.Duration.seconds(10),
  environment: {
    BOOKS_TABLE: booksTable.tableName,
  },
};

const listBooksLambda = new lambda.Function(this, "listBooksHandler", {
  handler: "listBooks.handler",
  ...commonLambdaProps,
});
```

- Run `cdk boostrap`
- Add a following function:

```ts
export const handler = async () => {
  return [
    {
      id: 123,
      name: "Hello",
      completed: true,
    },
  ];
};
```

General note: Davit suggests splitting functions by resolver

- Next up: create a DynamoDB table to have a place to store data

```ts
const booksTable = new dynamodb.Table(this, "BooksTable", {
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  partitionKey: {
    name: "id",
    type: dynamodb.AttributeType.STRING,
  },
});

const listBooksLambda = new lambda.Function(this, "listBooksHandler", {
  runtime: lambda.Runtime.NODEJS_14_X,
  handler: "listBooks.handler",
  code: lambda.Code.fromAsset("functions"),
  memorySize: 1024,
  timeout: Duration.seconds(10),
  environment: {
    BOOKS_TABLE: booksTable.tableName,
  },
});

booksTable.grantReadData(listBooksLambda);

const listBookDataSource = api.addLambdaDataSource(
  "listBookDataSource",
  listBooksLambda,
);

listBookDataSource.createResolver({
  typeName: "Query",
  fieldName: "listBooks",
});
```

^ Make sure to only specify the required priviledges and nothing more

- Let's write a Lambda function! Alright, let's generate TS types first
  https://benoitboure.com/how-to-use-typescript-with-appsync-lambda-resolvers

- Empty function:

```ts
import { AppSyncResolverHandler } from "aws-lambda";
import { Book, Query } from "../types/books";

export const handler: AppSyncResolverHandler<null, Book[]> = async (event) => {
  console.log("event", event);

  return [
    {
      "id": "123",
      "name": "Sapiens",
      "completed": true,
    },
  ];
};
```

^ talk a bit about the event object: https://youtu.be/wj33jJ6DQdo?t=817

- Function with DDB:

```ts
import { AppSyncResolverHandler } from "aws-lambda";
import { Book } from "../types/books";
import { DynamoDB } from "aws-sdk";

const docClient = new DynamoDB.DocumentClient();

export const handler: AppSyncResolverHandler<null, Book[] | null> =
  async () => {
    try {
      if (!process.env.BOOKS_TABLE) {
        console.log("BOOKS_TABLE was not specified");
        return null;
      }

      const data = await docClient
        .scan({ TableName: process.env.BOOKS_TABLE })
        .promise();

      return data.Items as Book[];
    } catch (err) {
      console.log("DynamoDB error: ", err);
      return null;
    }
  };
```

- Next up - let's create a Node
- First, edit the Schema & regenerate types

```graphql
type Book {
  id: ID!
  name: String!
  completed: Boolean!
}

input BookInput {
  id: ID!
  name: String!
  completed: Boolean!
}

type Query {
  listBooks: [Book]!
}

type Mutation {
  createBook(book: BookInput!): Book
}
```

- create a Lambda function, data source & resolver

```ts
const createBookLambda = new lambda.Function(this, "createBookHandler", {
  runtime: lambda.Runtime.NODEJS_14_X,
  handler: "createBook.handler",
  code: lambda.Code.fromAsset("functions"),
  memorySize: 1024,
  timeout: Duration.seconds(10),
  environment: {
    BOOKS_TABLE: booksTable.tableName,
  },
});

booksTable.grantReadWriteData(listBooksLambda);

const createBookDataSource = api.addLambdaDataSource(
  "createBookDataSource",
  createBookLambda,
);

createBookDataSource.createResolver({
  typeName: "Mutation",
  fieldName: "createBook",
});
```

Lambda:

```ts
import { AppSyncResolverHandler } from "aws-lambda";
import { Book, MutationCreateBookArgs } from "../types/books";
import { DynamoDB } from "aws-sdk";

const docClient = new DynamoDB.DocumentClient();

export const handler: AppSyncResolverHandler<
  MutationCreateBookArgs,
  Book | null
> = async (event) => {
  const book = event.arguments.book;
  console.log("event", event);
  console.log("book", book);
  try {
    if (!process.env.BOOKS_TABLE) {
      console.log("BOOKS_TABLE was not specified");
      return null;
    }

    const data = await docClient
      .put({ TableName: process.env.BOOKS_TABLE, Item: book })
      .promise();

    return book;
  } catch (err) {
    console.log("DynamoDB error: ", err);
    return null;
  }
};
```

- Deploy & create a book
- Next up - getting a book by ID
- First, modify the schema & regenerate types

```graphql
type Query {
  listBooks: [Book]!
  getBookById(bookId: ID!): Book
}
```

- Add a getBookByIdLambda & resolver

```ts
const getBookByIdLambda = new lambda.Function(this, "getBookById", {
  runtime: lambda.Runtime.NODEJS_14_X,
  handler: "getBookById.handler",
  code: lambda.Code.fromAsset("functions"),
  memorySize: 1024,
  timeout: Duration.seconds(10),
  environment: {
    BOOKS_TABLE: booksTable.tableName,
  },
});

booksTable.grantReadData(getBookByIdLambda);

const getBookByIdDataSource = api.addLambdaDataSource(
  "getBookByIdDataSource",
  getBookByIdLambda,
);

getBookByIdDataSource.createResolver({
  typeName: "Query",
  fieldName: "getBookById",
});
```

- Lambda function:
  Note the `QueryGetBookByIdArgs` type

```ts
import { AppSyncResolverHandler } from "aws-lambda";
import { Book, QueryGetBookByIdArgs } from "../types/books";
import { DynamoDB } from "aws-sdk";

const docClient = new DynamoDB.DocumentClient();

export const handler: AppSyncResolverHandler<
  QueryGetBookByIdArgs,
  Book | null
> = async (event) => {
  try {
    if (!process.env.BOOKS_TABLE) {
      console.log("BOOKS_TABLE was not specified");
      return null;
    }

    const { Item } = await docClient
      .get({
        TableName: process.env.BOOKS_TABLE,
        Key: { id: event.arguments.bookId },
      })
      .promise();

    return Item as Book;
  } catch (err) {
    console.log("DynamoDB error: ", err);
    return null;
  }
};
```

- Next up, debugging
- Simulating a slow resolver
- Enabling logging in AppSync API:

```ts
logConfig: {
        fieldLogLevel: appsync.FieldLogLevel.ALL,
      },
```

- Enabling x-ray:
- `xrayEnabled: true`

```ts
const wait = (timeoutMs: number) =>
  new Promise((resolve) => setTimeout(resolve, timeoutMs));
```

- Show how errors are propagated to GraphQL API - errors array, show how to find logs
- Show how to investigate timeouts in X-Ray

- Update book:

```ts
export const handler: AppSyncResolverHandler<
  { book: UpdateBookInput },
  UpdateBookInput | null
> = async (event) => {
  const book = event.arguments.book;
  console.log("book", book);
  try {
    if (!process.env.BOOKS_TABLE) {
      console.log("BOOKS_TABLE was not specified");
      return null;
    }

    await docClient
      .update({
        TableName: process.env.BOOKS_TABLE,
        Key: { id: book.id },
        UpdateExpression: "SET #completed = :completed, #name = :name",
        ExpressionAttributeNames: {
          "#completed": "completed",
          "#name": "name",
        },
        ExpressionAttributeValues: {
          ":completed": book.completed,
          ":name": book.name,
        },
        ReturnValues: "UPDATED_NEW",
      })
      .promise();

    return book;
  } catch (err) {
    console.log("DynamoDB error: ", err);
    return null;
  }
};
```

- Talk with Rafał whether it's necessary to concatenate a string in order to skip some of the fields. I'd rather not make all fields in a mutation mandatory
- Show that all fields need to be specified
- Use https://github.com/tuplo/dynoexpr in order to create an UpdateExpression

- Delete a book:
-

- Subscription - https://www.youtube.com/watch?v=0G5UsNqh4ak
- First, edit the schema

```graphql
type Subscription {
  onCreateBook: Book @aws_subscribe(mutations: ["createBook"])
}
```

- Then show a subscription being updated side by side with the GraphQL playground
- Delete a stack

References:

- https://appsync-immersionday.workshop.aws/lab1/2_deploy-with-cdk.html
- https://aws.amazon.com/blogs/mobile/graphql-security-appsync-amplify/
- https://aws.amazon.com/blogs/mobile/building-scalable-graphql-apis-on-aws-with-cdk-and-aws-appsync/
- https://benoitboure.com/how-to-use-typescript-with-appsync-lambda-resolvers
- https://www.youtube.com/watch?v=DOGadkjV7Hs
