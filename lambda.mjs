import { ListTablesCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  UpdateCommand,
  PutCommand,
  DynamoDBDocumentClient,
  ScanCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "tasks"; // Ensure this is correct
const PARTITION_KEY = "tasks"; // Change this if needed (prefer "id")

export const handler = async (event, context) => {
  let response;

  try {
    switch (event.httpMethod) {
      case "GET":
        response = await handleGetRequest();
        break;
      case "POST":
        response = await handlePostRequest(event, context);
        break;
      case "PATCH":
        response = await handlePatchRequest(event);
        break;
      case "DELETE":
        response = await handleDeleteRequest(event);
        break;
      default:
        response = {
          statusCode: 400,
          body: JSON.stringify({
            message: "Invalid request type",
            event: event,
            context: context,
          }),
        };
    }
  } catch (error) {
    console.error("Error handling request:", error);
    response = {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
    };
  }

  return response;
};

// GET: Retrieve all tasks
const handleGetRequest = async () => {
  const command = new ScanCommand({
    TableName: TABLE_NAME,
  });

  const response = await docClient.send(command);

  return {
    statusCode: 200,
    body: JSON.stringify(response.Items),
  };
};

// POST: Create a new task
const handlePostRequest = async (event, context) => {
  const { name, completed } = JSON.parse(event.body);

  if (!name || typeof completed !== "boolean") {
    return { statusCode: 400, body: JSON.stringify({ message: "Invalid input data" }) };
  }

  const taskId = context.awsRequestId; // Unique ID

  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      [PARTITION_KEY]: taskId, // Using correct partition key
      name,
      completed,
    },
  });

  await docClient.send(command);

  return {
    statusCode: 201,
    body: JSON.stringify({ message: "Task created successfully", id: taskId }),
  };
};

// PATCH: Update a task
const handlePatchRequest = async (event) => {
  const { id, name, completed } = JSON.parse(event.body);

  if (!id || (!name && completed === undefined)) {
    return { statusCode: 400, body: JSON.stringify({ message: "Invalid input data" }) };
  }

  const command = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { [PARTITION_KEY]: id },
    ExpressionAttributeNames: { "#name": "name" },
    UpdateExpression: "SET #name = :n, completed = :c",
    ExpressionAttributeValues: { ":n": name, ":c": completed },
    ReturnValues: "ALL_NEW",
  });

  const response = await docClient.send(command);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Task updated successfully", task: response.Attributes }),
  };
};

// DELETE: Remove a task
const handleDeleteRequest = async (event) => {
  const { id } = JSON.parse(event.body);

  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ message: "Invalid input data" }) };
  }

  const command = new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { [PARTITION_KEY]: id },
    ReturnValues: "ALL_OLD",
  });

  const response = await docClient.send(command);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Task deleted successfully", task: response.Attributes }),
  };
};
