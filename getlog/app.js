// Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require("aws-sdk");
const auth = require("./auth");

const ddb = new AWS.DynamoDB.DocumentClient({
  apiVersion: "2012-08-10",
  region: process.env.AWS_REGION,
});

const { LOG_TABLE_NAME, TABLE_NAME } = process.env;

exports.handler = async (event) => {
  let logData;
  const authz = JSON.parse(event.body).authz;

  try {
    await auth.authenticate(authz);
  } catch (e) {
    console.log("Authz error:", e);
    return { statusCode: 401, body: e.stack };
  }

  const putParams = {
    TableName: TABLE_NAME,
    Item: {
      connectionId: event.requestContext.connectionId,
      authorized: true,
    },
  };

  try {
    await ddb.put(putParams).promise();
  } catch (err) {
    return {
      statusCode: 500,
      body: "Failed add authorization to connect table: " + JSON.stringify(err),
    };
  }

  try {
    logData = await ddb
      .scan({
        TableName: LOG_TABLE_NAME,
        ProjectionExpression: "entry, createdAt",
      })
      .promise();
  } catch (e) {
    return { statusCode: 500, body: e.stack };
  }

  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: "2018-11-29",
    endpoint:
      event.requestContext.domainName + "/" + event.requestContext.stage,
  });

  try {
    await apigwManagementApi
      .postToConnection({
        ConnectionId: event.requestContext.connectionId,
        Data: JSON.stringify(logData.Items),
      })
      .promise();
  } catch (e) {
    return { statusCode: 500, body: e.stack };
  }

  return { statusCode: 200, body: "Data sent." };
};
