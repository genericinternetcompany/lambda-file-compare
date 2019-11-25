'use strict';

var jsdiff = require('diff');
var AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' });


var s3 = new AWS.S3({apiVersion: '2006-03-01'});
var sns = new AWS.SNS({apiVersion: '2010-03-31'});


var documentUpdates = {
  documentName: "",
  changes: []
};


var bucketName = "";
var newVersionFileKey = "";
var newVersionFileContents = ""
var currentVersionFileKey = "";
var currentVersionFileContents = "";

exports.handler = function(event, context, callback){
  
  documentUpdates.changes = [];
  
  console.log(JSON.stringify(event));
  console.log(context)

  bucketName = event.Records[0].s3.bucket.name;
  newVersionFileKey = event.Records[0].s3.object.key;
  currentVersionFileKey = event.Records[0].s3.object.key.replace(".new", ".current");
  
  documentUpdates.documentName = newVersionFileKey.split('.')[0];
  
  console.log("Bucket Name: " + bucketName);
  console.log("New File Key: " + newVersionFileKey);
  console.log("Current File Key: " + currentVersionFileKey);
  
  s3.getObject({Bucket: bucketName, Key: newVersionFileKey}, function(err, data) {
    console.log(err);
    if (!err) {
      const newVersionFileContents = Buffer.from(data.Body).toString('utf8');
      s3.getObject({Bucket: bucketName, Key: currentVersionFileKey}, function(err2, data2) {
        console.log(err2);
        if (!err2) {
          const currentVersionFileContent = Buffer.from(data2.Body).toString('utf8');
      
          console.log("Parsed Body");
          
          var diff = jsdiff.diffSentences(newVersionFileContents, currentVersionFileContent);
          
          diff.forEach(function(part) {
            if(part.added || part.removed) {
              documentUpdates.changes.push(part);
            }
          });
          
          if(documentUpdates.changes.length > 0)
          {
            console.log(documentUpdates);
            
            var snsParameters = {
              TopicArn: process.env.TopicARN,
              Message: JSON.stringify(documentUpdates)
            }
            
            console.log("Out-puttung Changes");
            console.log(documentUpdates);

            sns.publish(snsParameters, function (err3, data3) {
                if (err3) {
                    console.log('error publishing to SNS');
                    console.log(data3);
                    console.log(err3);
                    callback(null, {
                      "statusCode": 400,
                      "isBase64Encoded": false,
                      "body": JSON.stringify({
                          "status": "Failed",
                          "message": err
                    })
                  });                
                } 
                else {
                    console.log('message published to SNS');
                    console.log(data3);
                    console.log(err3);
                    callback(null, {
                      "statusCode": 200,
                      "isBase64Encoded": false,
                      "body": JSON.stringify({
                          "status": "Success",
                          "message": "Changes Published to SNS - arn:aws:sns:us-east-1:866696246352:aws-mdigiacomi-testing"
                    })
                  });
                }
            });
          }
          else
          {
            callback(null, {
                "statusCode": 200,
                "isBase64Encoded": false,
                "body": JSON.stringify({
                    "status": "Success",
                    "message": "No Changes to Publish"
              })
            });
          }
        }
      });
    }  
  });
}