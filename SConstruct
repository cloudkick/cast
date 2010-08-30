#
# Licensed to Cloudkick, Inc ('Cloudkick') under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# Cloudkick licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
# 
#      http://www.apache.org/licenses/LICENSE-2.0
# 
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#

EnsureSConsVersion(1, 1, 0)

import os
import re
from os.path import join as pjoin

opts = Variables('build.py')

env = Environment(options=opts,
                  ENV = os.environ.copy(),
                  tools=['default'])

#TODO: convert this to a configure builder, so it gets cached
def read_version(prefix, path):
  version_re = re.compile("(.*)%s_VERSION_(?P<id>MAJOR|MINOR|PATCH)(\s+)=(\s+)(?P<num>\d)(.*)" % prefix)
  versions = {}
  fp = open(path, 'rb')
  for line in fp.readlines():
    m = version_re.match(line)
    if m:
      versions[m.group('id')] = int(m.group('num'))
  fp.close()
  return (versions['MAJOR'], versions['MINOR'], versions['PATCH'])

env['version_major'], env['version_minor'], env['version_patch'] = read_version('CAST', 'lib/util/version.js')
env['version_string'] = "%d.%d.%d"  % (env['version_major'], env['version_minor'], env['version_patch'])

conf = Configure(env, custom_tests = {})
conf.env['NODE'] = conf.env.WhereIs('node')
conf.env.AppendUnique(RPATH = conf.env.get('LIBPATH'))
env = conf.Finish()

Export("env")

source = SConscript("lib/SConscript")

testsource = env.Glob("tests/*.js") + env.Glob("tests/checks/*.js")

allsource = testsource + source
env["JSLINT"] = "$NODE lib/extern/node-jslint/bin/jslint.js"
jslint = [env.Command(pjoin('.jslint/', str(x))+".jslint", x, ["$JSLINT $SOURCE || exit 0"]) for x in allsource]
env.AlwaysBuild(jslint)

env.Alias('jslint', jslint)

# dox just didn't work well when I last tried it, the JSdoc -> Markdown code was recursive and buggy.
#env['JSDOX'] = "$NODE lib/extern/dox/bin/dox"
#docscmd = env.Command('cast-api-docs.html', allsource, "$JSDOX -p -t 'Cloudkick Cast' "+ " ".join([x.get_path() for x in source]) + ">$TARGET")
#env.Alias('docs', docscmd)


tests = sorted(testsource)
testcmd = env.Command('.tests_run', tests, "$NODE lib/extern/whiskey/bin/whiskey -I lib/ "+ " ".join([x.get_path() for x in tests]))
env.AlwaysBuild(testcmd)
env.Alias('test', testcmd)
env.Alias('tests', 'test')

jscovbuild = env.Command('lib/extern/node-jscoverage/jscoverage', env.Glob('lib/extern/node-jscoverage/*.c'),
                        "cd lib/extern/node-jscoverage/ && ./configure && make")
jsconvcopy = env.Command('lib-cov/out.list', allsource,
                        ['rm -rf lib-cov',
                        'lib/extern/node-jscoverage/jscoverage --no-instrument=extern lib lib-cov',
                        'echo $SOURCES>lib-cov/out.list'])
env.Depends(jsconvcopy, jscovbuild)
covcmd = env.Command('.tests_coverage', tests, "$NODE lib/extern/whiskey/bin/whiskey -I lib-cov/ "+ " ".join([x.get_path() for x in tests]))
env.Depends(covcmd, jsconvcopy)
env.AlwaysBuild(covcmd)
env.Alias('coverage', covcmd)
env.Alias('cov', 'coverage')
targets = []

env.Default(targets)
