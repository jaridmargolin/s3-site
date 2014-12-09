/*!
 * bucket.js
 *
 * Copyright (c) 2014
 */

// core
var path = require('path');
var fs = require('fs');

// 3rd party
var _ = require('underscore');
var async = require('async');
var mime = require('mime');
var AWS = require('aws-sdk');

// lib
var policy = require('./policy.json');


/* -----------------------------------------------------------------------------
 * Bucket
 * ---------------------------------------------------------------------------*/

/**
 * Interface to manipulate an s3 bucket.
 *
 * @constructor
 * @public
 *
 * @param {object} s3config - s3config (http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#constructor-property)
 * @param {string} name - site options.
 */
var Bucket = function (options, s3config) {
  // store all options on instance
  this.options = options;

  this.s3 = new AWS.S3(s3config || {});
  this.bucketName = this._createBucketName(options);

  // Make sure all methods are called with bucket as content. Necessary
  // due to using async for flow management.
  _.bindAll(this, 'deploy', 'destroy', 'verifyExistence', 'listContents',
    'removeContents', 'removeBucket', 'create', 'createBucket',
    'makeWebsite', 'makePublic', 'upload', 'uploadDirectory',
    'uploadFile', 'uploadContent', '_createBucketName', '_params');
};


/* -----------------------------------------------------------------------------
 * deploy
 * ---------------------------------------------------------------------------*/

/**
 * Upload a local folder to a bucket in s3. If a
 * bucket by the specified name already exists, first
 * remove the bucket and all of its contents.
 *
 * @public
 *
 * @parma {object} options - Deploy options.
 */
Bucket.prototype.deploy = function (callback) {
  async.series([this.destroy, this.create, this.upload], callback);
},


/* -----------------------------------------------------------------------------
 * destroy
 * ---------------------------------------------------------------------------*/

/**
 * Remove bucket and all of its contents.
 *
 * @public
 *
 * @param {function} callback - Function executed after removing
 *   bucket.
 */
Bucket.prototype.destroy = function (callback) {
  async.waterfall([
    this.verifyExistence,
    this.listContents,
    this.removeContents,
    this.removeBucket
  ], function (err) {
    return !err || err === 'Does not exist'
      ? callback()
      : callback(err);
  });
};

/**
 * Check for existence of bucket.
 *
 * @public
 *
 * @param {function} callback - Function executed after checking
 *   aws for resource.
 */
Bucket.prototype.verifyExistence = function (callback) {
  this.s3.headBucket(this._params(), function (err, data) {

    return err && err.statusCode == 404
      ? callback('Does not exist')
      : callback(err);
  });
};

/**
 * List contents of bucket.
 *
 * @public
 *
 * @param {function} callback - Function executed after listing
 *   bucket contents.
 */
Bucket.prototype.listContents = function (callback) {
  this.s3.listObjects(this._params(), function (err, res) {
    return callback(err, res ? res['Contents'] : null);
  });
};

/**
 * Remove contents from bucket.
 *
 * @public
 *
 * @param {object} contents - Contents to remove from bucket.
 * @param {function} callback - Function executed after removing
 *   bucket contents.
 */
Bucket.prototype.removeContents = function (contents, callback) {
  // no contents to remove from bucket
  if (!contents[0]) {
    return callback();
  }

  var Objects = _.map(contents, function (content) {
    return _.pick(content, 'Key');
  });

  this.s3.deleteObjects(this._params({
    Delete: { Objects: Objects }
  }), function (err) {
    callback(err);
  });
};

/**
 * Remove bucket from s3. Contents must first be empty.
 *
 * @public
 *
 * @param {function} callback - Function executed after removing
 *   bucket.
 */
Bucket.prototype.removeBucket = function (callback) {
  this.s3.deleteBucket(this._params(), callback);
};


/* -----------------------------------------------------------------------------
 * create
 * ---------------------------------------------------------------------------*/

/**
 * Create bucket suitable to host a static website.
 *
 * @private
 *
 * @param {function} callback - Function executed after creating
 *  bucket.
 */
Bucket.prototype.create = function (callback) {
  async.series([
    this.createBucket,
    this.makeWebsite,
    this.makePublic
  ], callback);
};

/**
 * Create bucket on s3.
 *
 * @public
 *
 * @param {function} callback - Function executed after creating
 *  bucket.
 */
Bucket.prototype.createBucket = function (callback) {
  this.s3.createBucket(this._params(), callback);
};

/**
 * Configure bucket for website hosting.
 *
 * @public
 *
 * @param {function} callback - Function executed after configuring
 *  bucket.
 */
Bucket.prototype.makeWebsite = function (callback) {
  var WebsiteConfiguration = {
    IndexDocument: { Suffix: this.options.indexDocument || 'index.html' }
  };

  this.s3.putBucketWebsite(this._params({
    WebsiteConfiguration: WebsiteConfiguration
  }), callback);
};

/**
 * Add bucket policy which makes all bucket contents publicly
 * accessible.
 *
 * @public
 *
 * @param {function} callback - Function executed after setting
 *  bucket policy.
 */
Bucket.prototype.makePublic = function (callback) {
  var bucketPolicy = _.clone(policy);
  bucketPolicy.Statement[0].Resource += this.bucketName + '/*';

  this.s3.putBucketPolicy(this._params({
    Policy: JSON.stringify(bucketPolicy)
  }), callback);
};


/* -----------------------------------------------------------------------------
 * upload
 * ---------------------------------------------------------------------------*/

/**
 * Upload src directory to bucket.
 *
 * @public
 *
 * @param {function} callback - Function executed after uploading
 *  directory.
 */
Bucket.prototype.upload = function (callback) {
  this.uploadDirectory(this.options.srcPath, callback);
};

/**
 * Upload a directory to s3.
 *
 * @public
 *
 * @param {string} directoryPath - Absolute path of directory to upload.
 * @param {function} callback - Function executed after uploading
 *  directory.
 */
Bucket.prototype.uploadDirectory = function (directoryPath, callback) {
  var readDirectory = _.partial(fs.readdir, directoryPath);
  var uploadContent = _.partial(this.uploadContent);

  async.waterfall([readDirectory, function (files, callback) {
    files = _.map(files, function(file) {
      return path.join(directoryPath, file);
    });

    async.each(files, uploadContent, callback);
  }], callback);
};

/**
 * Upload a file to s3 bucket.
 *
 * @public
 *
 * @param {string} filePath - Absolute path of file to upload.
 * @param {function} callback - Function executed after uploding
 *   file.
 */
Bucket.prototype.uploadFile = function (filePath, callback) {
  var fileKey = filePath.replace(this.options.srcPath, '').substr(1);

  var extension = path.extname(fileKey);
  if (_.contains(this.options.removeExtensions, extension)) {
    fileKey = fileKey.substr(0, fileKey.length - extension.length);
  }

  fs.readFile(filePath, _.bind(function (err, fileBuffer) {
    var params = this._params({
      Key: fileKey,
      Body: fileBuffer,
      ContentType: mime.lookup(filePath)
    });

    // Remove all browser caching on specified
    // resources
    if (_.contains(this.options.noCache, fileKey)) {
      _.extend(params, {
        CacheControl: 'no-cache, no-store, must-revalidate',
        Expires: (new Date()).toISOString()
      });
    }

    this.s3.putObject(params, callback);
  }, this));
};

/**
 * Wrapper that checks if path represents a file or a
 * directory, and calls an upload method accordingly.
 *
 * @public
 *
 * @param {string} path - Absolute path of content on file system.
 * @param {function} callback - Function passed as callback to
 *   corresponding upload method.
 */
Bucket.prototype.uploadContent = function (path, callback) {
  fs.stat(path, _.bind(function (err, stats) {
    if (err) {
      return callback(err);
    }

    return stats.isDirectory()
      ? this.uploadDirectory(path, callback)
      : this.uploadFile(path, callback);
  }, this));
};


/* -----------------------------------------------------------------------------
 * utils
 * ---------------------------------------------------------------------------*/

/**
 * Create bucket name by concatenating specified
 * options (name, env, prefix).
 *
 * @private
 *
 * @parma {object} options - Deploy options.
 */
Bucket.prototype._createBucketName = function (options) {
  var parts = [options.name];

  if (options.env) {
    parts.unshift(options.env);
  }

  if (options.prefix) {
    parts.unshift(options.prefix);
  }

  return parts.join('-');
};

/**
 * Create params for s3 calls. By mixing in required
 * Bucket key with any passed options.
 *
 * @private
 *
 * @param {object} options - Additional params to send to s3.
 */
Bucket.prototype._params = function (options) {
  return _.extend({
    Bucket: this.bucketName
  }, options || {});
};


/* -----------------------------------------------------------------------------
 * export
 * ---------------------------------------------------------------------------*/

module.exports = { Bucket: Bucket };