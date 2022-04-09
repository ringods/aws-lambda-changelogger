const aws = require('aws-sdk');

const awsRegion = process.env.AWS_REGION;
const tableName = process.env.TABLE_NAME;

var documentClient = new aws.DynamoDB.DocumentClient({
    region: awsRegion
});

exports.handler = async (event, context) => {
    // Get the object from the event and show its content type
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
    const timestamp = event.Records[0].eventTime;

    console.log('Object key:', key);
    const putParams = {
        Item: {
            'Filename': key,
            'Timestamp': timestamp,
        },
        TableName: tableName,
    };
    await documentClient.put(putParams, function(err, data) {
        if (err) {
            console.log(err, err.stack);
            return {
                response: 400,
                body: "Error " + JSON.stringify(err)
            };
        }
        else {
            console.log("Response Received: ", data);
            return {
                response: 200,
                body: "Entry written!"
            };
        }
    }).promise();
};