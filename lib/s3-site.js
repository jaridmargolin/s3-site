/*!
 * s3-site.js
 * 
 * Copyright (c) 2013
 */


// ----------------------------------------------------------------------------
// Dependencies
// ----------------------------------------------------------------------------

// Core Dependencies
var path = require('path'),
    fs   = require('fs');

// Lib Dependencies
var async = require('async'),
    AWS   = require('aws-sdk'),
    _     = require('underscore');

// Data Dependencies
var policy = require('./policy.json');


// ----------------------------------------------------------------------------
// Scope Vars
// ----------------------------------------------------------------------------

var s3;


// ----------------------------------------------------------------------------
// Module
// ----------------------------------------------------------------------------

var s3site = module.exports = exports = {};


// ----------------------------------------------------------------------------
// Methods
// ----------------------------------------------------------------------------

//
//
//
s3site.deploy = function (config) {
  // Set region for all future calls
  s3 = new AWS.S3({
    region: config.region
  });

  // Bucket name
  var name = config.prefix + '-' + config.env + '-' + config.name;

  // Begin
  async.series([
    async.apply(clear, name),
    async.apply(create, name),
    async.apply(convert, name),
    async.apply(grant, name),
    async.apply(upload, config.src, name)
  ], onComplete);
};

//
//
//
s3site.onComplete = function (err, data) {
  console.log(err);
  console.log(data);
};

//
//
//
s3site.clear = function (name, next) {
  var bucket = { Bucket: name };

  async.waterfall([
    //
    //
    //
    function headBucket(next) {
      s3.headBucket(bucket, function (err, data) {
        return next(err && err.statusCode == 404 ? null : err);
      });
    },

    //
    //
    //
    function listObjects(next) {
      s3.listObjects(bucket, next);
    },

    //
    //
    //
    function deleteObjects(res, nest) {
      if (!res.Contents[0]) { return next(); }

      var Contents = _.map(res.Contents, function (contents) {
        return { Key: contents.Key }
      });

      s3.deleteObjects(_.extend({
        Delete: { Objects: Contents }
      }, bucket), next);
    },

    //
    //
    //
    function deleteBucket(next) {
      s3.deleteBucket(bucket, next);
    }
  ], next);
};

//
//
//
s3site.create = function (name, next) {
  s3.createBucket({ Bucket: name }, next);
};

//
//
//
s3site.convert = function (name, next) {
  s3.putBucketWebsite({
    Bucket: name,
    WebsiteConfiguration: {
      IndexDocument: { Suffix: 'index.html' }
    }
  }, next);
};

//
//
//
s3site.grant = function (name, next) {
  var bucketPolicy = _.extend({}, policy);
  bucketPolicy.Statement[0].Resource += name + '/*';

  s3.putBucketPolicy({
    Bucket: name,
    Policy: JSON.stringify(bucketPolicy)
  }, next);
};

//
//
//
s3site.upload = function (src, name, next) {
  //
  //
  //
  var uploadDir = function (key, next) {
    var dir = path.join(src, key);

    //
    //
    //
    var processDir = function (files, next) {
      async.each(files, processFile, next);
    };

    //
    //
    //
    var processFile = function (file, next) {
      var filePath = path.join(src, key, file);

      fs.stat(filePath, function (err, stats) {
        if (err) { return next(err); }

        var fileKey = path.join(key, file);
        return stats.isDirectory()
          ? uploadDir(fileKey, next)
          : putFile(filePath, fileKey, next);
      });
    };

    //
    //
    //
    var putFile = function (file, key, next) {
      var fileBuffer = fs.readFileSync(file);

      s3.putObject({
        Bucket: name,
        Key: key,
        Body: fileBuffer,
      }, next);
    };

    // Init upload
    async.waterfall([
      async.apply(fs.readdir, dir),
      processDir,
    ], next);
  };

  // Initiate recursive dir upload
  uploadDir('', next);
};