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
