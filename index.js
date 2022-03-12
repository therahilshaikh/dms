require("dotenv/config");
const AWS = require("aws-sdk");
const axios = require("axios"); // for sending http request to elastic
const express = require("express");
var multerS3 = require("multer-s3"); //for interacting with S3
var multer = require("multer")
var fs = require("fs-extra"); // for creating folders
var cors = require("cors");


const app = express();
app.use(cors()); // for allowing access to this port from another IP


// setting up aws credentials
const s3 = new AWS.S3({
    credentials: {
        accessKeyId: process.env.AWS_ID,
        secretAccessKey: process.env.AWS_SECRET,
        region: process.env.AWS_REGION_NAME,
        bucket: process.env.AWS_BUCKET_NAME,
    },
});

var upload = multer({
    storage: multerS3({
        s3: s3,

        bucket: function (req, file, cb) {
            cb(null, req.body.bucketName);
        },

        metadata: function (req, file, cb) {
            cb(null, { fieldName: file.fieldname });
        },
        key: function (req, file, cb) {
            cb(null, decodeURIComponent(file.originalname));
        },
    }),
});

app.post("/dms/upload", (req, res, next) => {
    // authenticating API call
    if (authenticateUser(req.headers["apikey"])) {
        upload.array("file")(req, res, function (err) {
            if (err) {
                // A Multer error occurred when uploading.
                res.send(err.message);
            } res.send(req.files)

        });
    } else {
        res.sendStatus(403);
    }
});
//download file from S3
app.get("/dms/download", function (req, res, next) {
    // download the file via aws s3 here 'fileDownloadKey' & 'bucketName' keys in parameter

    if (authenticateUser(req.headers["apikey"])) {
        var options = {
            Bucket: req.query.bucketName,
            Key: req.query.fileKey,
            VersionId: req.query.versionId
        };
        s3.getObject(options, function (err, data) {
            if (err) {
                res.sendStatus(err.statusCode);
            } else {
                res.attachment(req.query.fileKey);
                res.send(data.Body);
            }
        });
    } else {
        res.sendStatus(403);
    }
});
// Delete files from S3

app.delete("/dms/delete", function (req, res, next) {
    if (authenticateUser(req.headers["apikey"])) {
        var deleteParams = {
            Bucket: req.query.bucketName,
            Key: req.query.fileKey,
        };
        s3.deleteObject(deleteParams, function (err, data) {
            if (err) res.sendStatus(err);
            // error
            else {
                res.sendStatus(200);
            } // deleted
        });
    } else res.sendStatus(403);
});

// List all buckets
app.get("/dms/listAllBuckets", function (req, res) {
    // list all buckets in S3
    if (authenticateUser(req.headers["apikey"])) {
        s3.listBuckets(function (err, data) {
            if (err) {
                res.send(err);
            } else {
                res.send(data.Buckets);
            }
        });
    } else res.sendStatus(403);
});
// List All Object

app.get('/dms/listAllObject', async (req, res) => {
    if (authenticateUser(req.headers["apikey"])) {
        let r = await s3.listObjectsV2({ Bucket: req.query.bucketName }).promise();
        let listOfFiles = r.Contents.map((item) => item.Key);
        res.send(listOfFiles);
    } else res.sendStatus(403);
});

// authentication check
// this function returns true if apiKey matches else false
function authenticateUser(apiKey) {
    if (apiKey == process.env.API_KEY) 
        return true;
     else 
        return false;
    
}
app.listen(3131);
