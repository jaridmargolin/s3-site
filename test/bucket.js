/*!
 * test/bucket.js
 * 
 * Copyright (c) 2014
 */

// core
var path = require('path');
var fs = require('fs');

// 3rd party
var _ = require('underscore');
var async = require('async');
var assert = require('chai').assert;
var request = require('request');
var nock = require('nock');
var AWS = require('aws-sdk');

// lib
var Bucket = require('../lib/bucket').Bucket;


/* -----------------------------------------------------------------------------
 * scope
 * ---------------------------------------------------------------------------*/

// AWS eventual consistency is making my life a nightmare.
var TEST_DELAY = 0;

var s3config = {
  accessKeyId: 'AccessKeyId',
  secretAccessKey: 'SecrectAccessKey'
};

var sitePath = path.join(__dirname, 'fixtures/site');
var indexPath = path.join(__dirname, 'fixtures/site/index.html');
var siteUrl = 'http://s3site-test-site.s3-website-us-east-1.amazonaws.com/';


/* -----------------------------------------------------------------------------
 * record/mock http requests
 * ---------------------------------------------------------------------------*/

// temporary hack due to limitations with nock.
// https://github.com/pgte/nock/issues/112
AWS.HttpClient.streamsApiVersion = 1;

var mocksPath = path.join(__dirname, 'fixtures/mocks/data.json');
var mocksExist = fs.existsSync(mocksPath);


/* -----------------------------------------------------------------------------
 * reusable tasks
 * ---------------------------------------------------------------------------*/

/**
 * Quick upload
 */
var uploadFile = function (callback) {
  var uploadFile = _.partial(this.siteBucket.uploadFile, indexPath);

  async.series([
    this.siteBucket.createBucket,
    uploadFile,
  ], callback);
};

/**
 * Quick cleanup
 */
var destroy = function (done) {
  this.siteBucket.destroy(function (err) {
    assert.notOk(err);
    done();
  });
};


/* -----------------------------------------------------------------------------
 * Bucket
 * ---------------------------------------------------------------------------*/

describe('bucket.js', function () {

  // Adjust timeout as we are working with a 3rd party
  // api and network latency will play a role in test results.
  // 10 seconds should be plenty of time.
  this.timeout(15000);

  // This is the bucket wil will primarily be using for every test.
  beforeEach(function () {
    // custom bucket that has been manually setup sepcifically for
    // testing bucket/file existence.
    this.fakeBucket = new Bucket({
      name   : 'doesnt',
      env    : 'test',
      prefix : 's3site'
    }, s3config);

    // custom bucket that has been manually setup sepcifically for
    // testing bucket/file existence.
    this.staticBucket = new Bucket({
      name   : 'exists',
      env    : 'test',
      prefix : 's3site'
    }, s3config);

    this.siteBucket = new Bucket({
      name    : 'site',
      env     : 'test',
      prefix  : 's3site',
      srcPath : sitePath
    }, s3config);
  });

  // Eventually consistency. Boo!
  afterEach(function (done) {
    setTimeout(done, TEST_DELAY);
  });


  /* -----------------------------------------------------------------------------
   * record/mock http requests
   * ---------------------------------------------------------------------------*/

  // load or record
  before(function () {
    if (mocksExist) {
      nock.load(mocksPath);
    } else {
      TEST_DELAY = 1000;
      nock.recorder.rec({
        dont_print: true,
        output_objects: true
      });
    }
  });


  // write out recordings
  after(function (done) {
    if (mocksExist) {
      return done();
    }

    fs.writeFile(mocksPath, JSON.stringify(nock.recorder.play()), function () {
      done();
    });
  });


  /* ---------------------------------------------------------------------------
   * verifyExistence
   * -------------------------------------------------------------------------*/

  describe('verifyExistence', function () {

    it('Should not return error if bucket exists.', function (done) {
      this.staticBucket.verifyExistence(function (err) {
        assert.notOk(err);
        done();
      });
    });

    it('Should return error if bucket does not exist.', function () {
      this.fakeBucket.verifyExistence(function (err) {
        assert.equal(err, 'Does not exist');
      });
    });

  });


  /* ---------------------------------------------------------------------------
   * createBucket/removeBucket
   * -------------------------------------------------------------------------*/

  describe('createBucket/removeBucket', function () {

    it('Should create bucket.', function (done) {
      async.series([
        this.siteBucket.createBucket,
        this.siteBucket.verifyExistence
      ], function (err) {
        assert.notOk(err);
        done();
      });
    });

    it('Should remove bucket.', function (done) {
      async.series([
        this.siteBucket.removeBucket,
        this.siteBucket.verifyExistence
      ], function (err) {
        assert.equal(err, 'Does not exist');
        done();
      });
    });

  });


  /* ---------------------------------------------------------------------------
   * listContents
   * -------------------------------------------------------------------------*/

  describe('listContents', function () {

    it('Should list contents.', function (done) {
      this.staticBucket.listContents(function (err, results) {
        assert.equal(results.length, 1);
        done();
      });
    });

  });


  /* ---------------------------------------------------------------------------
   * uploadFile
   * -------------------------------------------------------------------------*/

  describe('uploadFile', function () {

    afterEach(function (done) {
      async.waterfall([
        this.siteBucket.listContents,
        this.siteBucket.removeContents,
        this.siteBucket.removeBucket
      ], function (err, results) {
        assert.notOk(err);
        done();
      });
    });

    it('Should upload file', function (done) {
      async.series([
        _.bind(uploadFile, this),
        this.siteBucket.listContents
      ], function (err, results) {
        assert.equal(results[1].length, 1);
        done();
      });
    });

  });


  /* ---------------------------------------------------------------------------
   * removeContents
   * -------------------------------------------------------------------------*/

  describe('removeContents', function () {

    afterEach(function (done) {
      this.siteBucket.removeBucket(function (err, results) {
        assert.notOk(err);
        done();
      });
    });

    it('Should remove contents from bucket.', function (done) {
      var removeContents = _.bind(function () {
        async.waterfall([
          this.siteBucket.listContents,
          this.siteBucket.removeContents,
          this.siteBucket.listContents
        ], function (err, contents) {
          assert.equal(contents.length, 0);
          done();
        });
      }, this);

      _.bind(uploadFile, this)(removeContents);
    });

  });


  /* ---------------------------------------------------------------------------
   * destroy
   * -------------------------------------------------------------------------*/

  describe('destroy', function () {

    it('Should remove bucket and bucket contents.', function (done) {
      async.series([
        _.bind(uploadFile, this),
        this.siteBucket.destroy,
        this.siteBucket.verifyExistence
      ], function (err, results) {
        assert.equal(err, 'Does not exist');
        done();
      });
    });

  });


  /* ---------------------------------------------------------------------------
   * uploadDirectory
   * -------------------------------------------------------------------------*/

  describe('uploadDirectory', function () {

    afterEach(function (done) {
      destroy.call(this, done);
    });

    it('Should uploadDirectory', function (done) {
      var uploadDirectory = async.apply(this.siteBucket.uploadDirectory, sitePath);

      async.series([
        this.siteBucket.createBucket,
        uploadDirectory,
        this.siteBucket.listContents
      ], function (err, results) {
        var keys = _.pluck(results[2], 'Key');
        assert.ok(_.contains(keys, 'nested/folder/test.html'));
        done();
      });
    });

  });


  /* ---------------------------------------------------------------------------
   * upload
   * -------------------------------------------------------------------------*/

  describe('upload', function () {

    afterEach(function (done) {
      destroy.call(this, done);
    });

    it('Should upload srcPath directory contents to bucket.', function (done) {
      async.series([
        this.siteBucket.createBucket,
        this.siteBucket.upload,
        this.siteBucket.listContents
      ], function (err, results) {
        var keys = _.pluck(results[2], 'Key');
        assert.ok(_.contains(keys, 'nested/folder/test.html'));
        done();
      });
    });

  });


  /* ---------------------------------------------------------------------------
   * deploy
   * -------------------------------------------------------------------------*/

  describe('deploy', function () {

    afterEach(function (done) {
      destroy.call(this, done);
    });

    it('Should expose contents at a public url.', function (done) {      
      this.siteBucket.deploy(function () {
        setTimeout(function () {
          request(siteUrl, function (err, res, body) {
            assert.isTrue(!err && res.statusCode === 200);
            done();
          });
        }, TEST_DELAY);
      });
    });

  });

});