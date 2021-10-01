import { AppSyncResolverHandler } from "aws-lambda";
import { MutationUpdateBookArgs, UpdateBookInput } from "../types/books";
import { DynamoDB } from "aws-sdk";

const docClient = new DynamoDB.DocumentClient();

export const handler: AppSyncResolverHandler<
  MutationUpdateBookArgs,
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
