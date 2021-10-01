import * as cdk from "@aws-cdk/core";
import * as appsync from "@aws-cdk/aws-appsync";
import * as lambda from "@aws-cdk/aws-lambda";
import * as dynamodb from "@aws-cdk/aws-dynamodb";

export class AppsyncCdkYoloStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const api = new appsync.GraphqlApi(this, "Api", {
      name: "my-api",
      schema: appsync.Schema.fromAsset("graphql/schema.graphql"),
      logConfig: {
        fieldLogLevel: appsync.FieldLogLevel.ALL,
      },
      xrayEnabled: true,
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
    });

    const booksTable = new dynamodb.Table(this, "BooksTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: "id",
        type: dynamodb.AttributeType.STRING,
      },
    });

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

    booksTable.grantReadData(listBooksLambda);

    const listBooksDataSource = api.addLambdaDataSource(
      "listBooksDataSource",
      listBooksLambda,
    );

    listBooksDataSource.createResolver({
      typeName: "Query",
      fieldName: "listBooks",
    });

    const getBookByIdLambda = new lambda.Function(this, "getBookById", {
      handler: "getBookById.handler",
      ...commonLambdaProps,
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

    const createBookLambda = new lambda.Function(this, "createBookHandler", {
      handler: "createBook.handler",
      ...commonLambdaProps,
    });

    booksTable.grantReadWriteData(createBookLambda);

    const createBookDataSource = api.addLambdaDataSource(
      "createBookDataSource",
      createBookLambda,
    );

    createBookDataSource.createResolver({
      typeName: "Mutation",
      fieldName: "createBook",
    });

    const updateBookLambda = new lambda.Function(this, "updateBookHandler", {
      handler: "updateBook.handler",
      ...commonLambdaProps,
    });

    booksTable.grantReadWriteData(updateBookLambda);

    const updateBookDataSource = api.addLambdaDataSource(
      "updateBookDataSource",
      updateBookLambda,
    );

    updateBookDataSource.createResolver({
      typeName: "Mutation",
      fieldName: "updateBook",
    });

    const deleteBookLambda = new lambda.Function(this, "deleteBookHandler", {
      handler: "mineBitcoin.handler",
      ...commonLambdaProps,
    });

    booksTable.grantReadWriteData(deleteBookLambda);

    const deleteBookDataSource = api.addLambdaDataSource(
      "deleteBookDataSource",
      deleteBookLambda,
    );

    deleteBookDataSource.createResolver({
      typeName: "Mutation",
      fieldName: "deleteBook",
    });

    new cdk.CfnOutput(this, "GraphQLAPIURL", {
      value: api.graphqlUrl,
    });

    // Prints out the AppSync GraphQL API key to the terminal
    new cdk.CfnOutput(this, "GraphQLAPIKey", {
      value: api.apiKey || "",
    });
  }
}
