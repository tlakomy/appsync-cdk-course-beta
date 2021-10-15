## Lesson 1.

**Create an AWS CDK stack from scratch**

Description:
_Before we start working on our GraphQL API, we need to create a project first. In this lesson, we're going to learn how to create a brand new CDK project from scratch._

Steps:

- `npm install aws-cdk`
- `cdk --version`
- `aws s3 ls`
- `aws sts get-caller-identity` ("You shouldn't share your account number")
- `mkdir my-graphql-api`
- `cdk init app --language=typescript`

## Lesson 2.

**Deploy a CDK stack to AWS**

Description:
_Even though our stack is empty, we should deploy it to AWS to verify that everything is set up properly. In this lesson, we're going to learn how to use `cdk deploy` command in order to ship our brand new stack to AWS._

Steps:

- `npm run watch`
- Show that it's generating JS files (`const hello: string = "world";`)
- `cdk bootstrap` (mention that it's necessary only for new regions/accounts)
- `cdk deploy`
- Go to CloudFormation, verify that the stack is there
- Take a look at CloudFormation template

## Lesson 3

**Create an AppSync GraphQL API**

Description: _It's time to start learning AppSync & GraphQL. In this lesson, we're going to create a simple schema for a bookstore website and create a GraphQL API using AppSync._

Steps:

- Create a schema

`graphql/schema.graphql`

```graphql
type Book {
  id: ID!
  name: String!
  completed: Boolean!
  rating: Int!
  reviews: [String]!
}

type Query {
  listBooks: [Book]
}
```

- `npm install @aws-cdk/aws-appsync`
- Create an AppSync-powered GraphQL API:

```ts
const api = new appsync.GraphqlApi(this, "Api", {
  name: "my-api",
  schema: appsync.Schema.fromAsset("graphql/schema.graphql"),
});
```

- Go to AWS Console, verify that the API is there in CloudFormation/AppSync console
- Open GraphQL playground, send a request, it'll fail due to lack of auth headers
- Specify the `x-api-key` header and copy the value from the Console

## Lesson 4

**Add an API key to an AppSync API**

Description: _All AppSync-powered APIs need to have some sort of authentication (othrwise there'd be a risk of DDoS attack, which might be costly). In this lesson we're going to learn how to add a non-default API key authorization to our AppSync API._

Steps:

- Add an authorization config to our API:

```ts
authorizationConfig: {
  defaultAuthorization: {
    authorizationType: appsync.AuthorizationType.API_KEY,
    apiKeyConfig: {
      description: "An API key for my revolutionary bookstore app",
      name: "My API Key",
      expires: cdk.Expiration.after(cdk.Duration.days(365)), // Mention that by default it's 7 days
    },
  },
},
```

- To make our life easier, let's add two CloudFormation outputs:

```ts
new cdk.CfnOutput(this, "GraphQLAPIURL", {
  value: api.graphqlUrl,
});

new cdk.CfnOutput(this, "GraphQLAPIKey", {
  value: api.apiKey || "",
});
```

- Call `listBooks` query with our brand new API key:

```graphql
query ListBooks {
  listBooks {
    id
    name
  }
}
```

## Lesson 5

**Add a Lambda data source to an AppSync API**

Description:

_It's time to start writing business logic. In this lesson we're going to learn how to create an AWS Lambda data source and connect it to a GraphQL API powered by AppSync._

Steps:

- `npm install @aws-cdk/aws-lambda`

```ts
const listBooksLambda = new lambda.Function(this, "listBooksHandler", {
  handler: "listBooks.handler",
  runtime: lambda.Runtime.NODEJS_14_X,
  code: lambda.Code.fromAsset("functions"),
});
```

- Create a `functions/listBooks.ts` file with the following content:

```ts
export const handler = async () => {
  return [
    {
      id: 123,
      name: "My Awesome Book",
      completed: true,
      rating: 10,
      reviews: ["The best book ever written"],
    },
  ];
};
```

- Next add a lambda data source and create a GraphQL resolver:

```ts
const listBookDataSource = api.addLambdaDataSource(
  "listBookDataSource",
  listBooksLambda,
);

listBookDataSource.createResolver({
  typeName: "Query",
  fieldName: "listBooks",
});
```

- Run `cdk diff` to understand what is about to be deployed
- Deploy & verify that a resolver has been attached
- Test the API

## Lesson 6

**Create a DynamoDB table to store books**

Description: _Our API definitely shouldn't rely on hardcoded data. In this lesson, we're going to learn how to create a DynamoDB table, and allow a Lamdbda function to access its data._

## Lesson X

**Refactor a CDK stack and change Lambda function architecture**
