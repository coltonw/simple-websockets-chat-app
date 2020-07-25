// Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require("aws-sdk");

const ddb = new AWS.DynamoDB.DocumentClient({
  apiVersion: "2012-08-10",
  region: process.env.AWS_REGION,
});

const { LOG_TABLE_NAME } = process.env;

exports.handler = async (event) => {
  let logData;

  console.log(1);
  try {
    logData = await ddb
      .scan({
        TableName: LOG_TABLE_NAME,
        ProjectionExpression: "entry, createdAt",
      })
      .promise();
  } catch (e) {
    console.log(e);
    return { statusCode: 500, body: e.stack };
  }
  console.log(2);

  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: "2018-11-29",
    endpoint:
      event.requestContext.domainName + "/" + event.requestContext.stage,
  });

  console.log(3);

  try {
    await apigwManagementApi
      .postToConnection({
        ConnectionId: event.requestContext.connectionId,
        Data: JSON.stringify(logData.Items),
      })
      .promise();
  } catch (e) {
    console.log(e);
    return { statusCode: 500, body: e.stack };
  }
  console.log(4);

  return { statusCode: 200, body: "Data sent." };
};
