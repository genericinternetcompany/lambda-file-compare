'use strict';
require('colors');

var AWS = require('aws-sdk');
var jsdiff = require('diff');

var s3 = new AWS.S3({apiVersion: '2006-03-01'});
AWS.config.update({ region: 'us-east-1' });

var changes = [];
var bucketName = "";
var newVersionFileKey = "";
var newVersionFileContents = ""
var currentVersionFileKey = "";
var currentVersionFileContents = "";

exports.handler = function(event, context, callback){

  bucketName = event.Records[0].s3.bucket.name;
  newVersionFileKey = event.Records[0].s3.object.key;
  currentVersionFileKey = event.Records[0].s3.object.key.replace(".new", ".current");
  
  s3.getObject({Bucket: bucketName, Key: newVersionFileKey}, function(err, data) {
    if (!err) {
      const newVersionFileContents = Buffer.from(data.Body).toString('utf8');
      s3.getObject({Bucket: bucketName, Key: currentVersionFileKey}, function(err, data2) {
        const currentVersionFileContent = Buffer.from(data2.Body).toString('utf8');
        if (!err) {
      
          console.log("Parsed Body");
          
          var diff = jsdiff.diffSentences(newVersionFileContents, currentVersionFileContent);
          
          diff.forEach(function(part) {
            if(part.added || part.removed) {
              changes.push(part);
            }
          });
          
          if(changes.length > -1)
          {
            var snsParameters = {
              TopicArn: "arn:aws:sns:us-east-1:866696246352:aws-mdigiacomi-testing",
              Message: JSON.stringify(changes)
            }

            var sns = new AWS.SNS();
            sns.publish(snsParameters, function (err, data) {
                if (err) {
                    console.log('error publishing to SNS');
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