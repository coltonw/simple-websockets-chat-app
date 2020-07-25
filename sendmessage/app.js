// Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require("aws-sdk");

const ddb = new AWS.DynamoDB.DocumentClient({
  apiVersion: "2012-08-10",
  region: process.env.AWS_REGION,
});

const { TABLE_NAME, LOG_TABLE_NAME } = process.env;

exports.handler = async (event) => {
  const postData = JSON.parse(event.body).data;

  const putParams = {
    TableName: LOG_TABLE_NAME,
    Item: {
      entry: postData,
      createdAt: Date.now(),
    },
  };

  try {
    await ddb.put(putParams).promise();
  } catch (err) {
    return {
      statusCode: 500,
      body: "Failed to add msg to log: " + JSON.stringify(err),
    };
  }

  let connectionData;

  try {
    connectionData = await ddb.scan({ TableName: TABLE_NAME }).promise();
  } catch (e) {
    return { statusCode: 500, body: e.stack };
  }

  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: "2018-11-29",
    endpoint:
      event.requestContext.domainName + "/" + event.requestContext.stage,
  });

  let postCalls = connectionData.Items.map(
    async ({ connectionId, authorized }) => {
      if (!authorized) return;
      try {
        await apigwManagementApi
          .postToConnection({ ConnectionId: connectionId, Data: postData })
          .promise();
      } catch (e) {
        if (e.statusCode === 410) {
          console.log(`Found stale connection, deleting ${connectionId}`);
          await ddb
            .delete({ TableName: TABLE_NAME, Key: { connectionId } })
            .promise();
        } else {
          throw e;
        }
      }
    }
  );

  try {
    await Promise.all(postCalls);
  } catch (e) {
    return { statusCode: 500, body: e.stack };
  }

  return { statusCode: 200, body: "Data sent." };
};
