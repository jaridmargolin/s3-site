s3-site [![Build Status](https://travis-ci.org/firstopinion/s3-site.png)](https://travis-ci.org/firstopinion/s3-site)
=======

Create, manipulate, and deploy static websites to Amazon S3


## Why?

Amazon S3 is a fantastic solution for hositng static websites, however, I found there to be a fair ammount of overhead in configuring and deploying. The goal of s3-site is to ease that burden.


## Install

```
npm install s3-site --save-dev
```

## Usage

Deploy to: [prefix]-[env]-[name].s3-website-[region].amazonaws.com

**Require**

```
var s3site = require('s3-site');
```

**Deploy**

```
s3site.deploy({
  name    : [name],
  env     : [env],
  prefix  : [prefix],
  region  : [region],
  srcPath : [src]
});
```

## License

The MIT License (MIT)
Copyright (c) 2014 First Opinion

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.