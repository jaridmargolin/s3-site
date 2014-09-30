/*!
 * s3-site.js
 * 
 * Copyright (c) 2014
 */

// lib
var Bucket = require('./bucket').Bucket;


/* -----------------------------------------------------------------------------
 * s3site
 * ---------------------------------------------------------------------------*/

module.exports = {

  /**
   * Upload a local folder to a bucket in s3. If a
   * bucket by the specified name already exists, first
   * remove the bucket and all of its contents.
   *
   * @public
   *
   * @param {object} options - s3site options.
   * @param {object} s3config - AWS.s3 constructor options.
   * @param {function} callback - Function executed after deploy.
   */
  deploy: function (options, s3config, callback) {
    var bucket = new Bucket(options, s3config);
    bucket.deploy(callback);
  }

};