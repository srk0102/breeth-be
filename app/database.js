// database.js
import dynamoose from "dynamoose";
const { Logger } = require("../utils");

import {
  AWS_REGION,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  DYNAMODB_ENDPOINT,
} from "../config";

export const connectDB = async () => {
  try {
    const dynamoDBConfig = {
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    };

    if (DYNAMODB_ENDPOINT) {
      Logger.info("Using local DynamoDB endpoint");
      dynamoose.aws.ddb.local(DYNAMODB_ENDPOINT);
    } else {
      Logger.info(`Connecting to AWS DynamoDB in region: ${AWS_REGION}`);
    }

    const ddb = new dynamoose.aws.ddb.DynamoDB(dynamoDBConfig);
    dynamoose.aws.ddb.set(ddb);

    Logger.success(
      `Connected to DynamoDB successfully (${
        DYNAMODB_ENDPOINT ? "Local" : "AWS"
      })`
    );
  } catch (error) {
    Logger.error("DynamoDB connection error:", error);
    throw error;
  }
};
