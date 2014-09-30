/*!
 * s3-site.js
 * 
 * Copyright (c) 2014
 */

// lib
var Bucket = require('./bucket');


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
   * @parma {object} options - Deploy options.
   */
  deploy: function (options) {
    var bucket = new Bucket(options);
    bucket.deploy();
  }

};