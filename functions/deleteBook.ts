import { AppSyncResolverHandler } from "aws-lambda";
import { MutationDeleteBookArgs, Scalars } from "../types/books";
import { DynamoDB } from "aws-sdk";

const docClient = new DynamoDB.DocumentClient();

export const handler: AppSyncResolverHandler<
  MutationDeleteBookArgs,
  Scalars["ID"] | null
> = async (event) => {
  try {
    const bookId = event.arguments.bookId;
    if (!process.env.BOOKS_TABLE) {
      console.log("BOOKS_TABLE was not specified");
      return null;
    }

    await docClient
      .delete({
        TableName: process.env.BOOKS_TABLE,
        Key: {
          id: bookId,
        },
      })
      .promise();

    return bookId;
  } catch (err) {
    console.log("DynamoDB error: ", err);
    return null;
  }
};
