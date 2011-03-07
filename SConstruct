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

from utils import download_file, get_file_list

cwd = os.getcwd()

opts = Variables('build.py')

opts.Add('node_tarball_url', default = '', help = 'URL to the Node tarball')
opts.Add('runit_tarball_url', default = '', help = 'URL to the Runit tarball')

env = Environment(options=opts,
                  ENV = os.environ.copy(),
                  tools = ['packaging', 'default'])

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
conf.env['NODE'] = os.environ['NODE_BIN_PATH'] if (os.environ.get('NODE_BIN_PATH', None)) else conf.env.WhereIs('node')
conf.env.AppendUnique(RPATH = conf.env.get('LIBPATH'))
env = conf.Finish()

Export("env")

source = SConscript("lib/SConscript")
testsource = env.Glob("tests/*.js") + env.Glob("tests/*/*.js")

allsource = testsource + source

env["JSLINT"] = "NODE_PATH=lib/extern/ $NODE lib/extern/Nodelint/bin/jslint"
jslint = env.Command(".xjslint", source, ["$JSLINT "+ " ".join([str(x) for x in source])])

env.AlwaysBuild(jslint)
env.Alias('jslint', jslint)

lenv = env.Clone()

lenv["ENV"]["PYTHONPATH"] = lenv.Dir('lib/extern/closure-linter').get_path() + ":" + lenv["ENV"].get("PYTHONPATH", "")
lenv["GJSLINT"] = "python -m closure_linter.gjslint"
lenv["GJSFIXSTYLE"] = "python -m closure_linter.fixjsstyle"
gjslint = lenv.Command(".gjslint", source, ["$GJSLINT "+ " ".join([x.get_path() for x in source])])
gfixjsstyle = lenv.Command(".gfixjsstyle", source, ["$GJSFIXSTYLE "+ " ".join([x.get_path() for x in source])])

lenv.AlwaysBuild(gjslint)
#lenv.AlwaysBuild(gfixjsstyle)
lenv.Alias('gjslint', gjslint)
lenv.Alias('gfixjsstyle', gfixjsstyle)

env['JSDOC'] = "NODE_PATH=lib/extern lib/extern/nclosure/bin/ncdoc.js"
docscmd = env.Command('.builddocs', allsource, "$JSDOC " + " ".join([x.get_path() for x in source]))
env.Alias('docs', docscmd)

uploaddocscmd = env.Command('.uploaddocs', '',
                            'git checkout gh-pages; '+
                            ' git add jsdoc/*; ' +
                            'git commit -m "Re-build documentation"; ' +
                            #'git push origin gh-pages;' +
                            'git checkout master')
env.Alias('upload-docs', uploaddocscmd)
env.Alias('build-docs', [ docscmd, uploaddocscmd ])
env.Depends(uploaddocscmd, docscmd)

IGNORED_TESTS = [ 'tests/run.js', 'tests/common.js', 'tests/data/' ]
tests = sorted(testsource)

test_files = []
for test in tests:
  skip = False
  for ignored_test in IGNORED_TESTS:
    if test.get_path().startswith(ignored_test):
      skip = True
      break
  if not skip:
    test_files.append(test.get_path())

testcmd = env.Command('.tests_run', [], "$NODE tests/run.js %s" % ' '.join(test_files))
env.AlwaysBuild(testcmd)
env.Alias('test', testcmd)
env.Alias('tests', 'test')

# Create a distribution tarball
dependencies = [
  [ env['node_tarball_url'], 'dist/deps/node.tar.gz' ],
  [ env['runit_tarball_url'], 'dist/deps/runit.tar.gz' ]
]

download_dependencies  = []
for dependency in dependencies:
  download_dependencies.append((env.Command('.%s' % (dependency[1]), '', download_file(dependency[0], dependency[1]))))

paths_to_include = [ 'bin', 'lib', 'other' ]
paths_to_skip = [ 'lib/extern/expresso', 'lib/extern/whiskey', 'lib/extern/Nodelint',
                  'lib/extern/jsdoc-toolkit', 'lib/extern/closure-linter',
                  'lib/extern/node-jscoverage',
                  'lib/SConscript', 'lib/README', 'other/SConstruct', 'other/site_scons' ]
files_to_pack = get_file_list(cwd, paths_to_include, paths_to_skip)

package = env.Package(
  PACKAGEROOT = '.',
  NAME = 'cast',
  VERSION = env['version_string'],
  PACKAGETYPE = 'src_targz',
  LICENSE = 'Apache 2.0',
  source =  files_to_pack,
  SOURCE_URL = 'https://github.com/cloudkick/cast/tarball/v%s' % (env['version_string'])
)

"""
jscovbuild = env.Command('lib/extern/node-jscoverage/jscoverage', env.Glob('lib/extern/node-jscoverage/*.c'),
                         "cd lib/extern/node-jscoverage/ && ./configure && make")
jsconvcopy = env.Command('lib-cov/out.list', allsource,
                        ['rm -rf lib-cov',
                        'lib/extern/node-jscoverage/jscoverage --no-instrument=extern lib lib-cov',
                        'echo $SOURCES>lib-cov/out.list'])
env.Depends(jsconvcopy, jscovbuild)
#TODO: Find a way to make coverage work in the new tester
covcmd = env.Command('.tests_coverage', tests, "$NODE tests/run.js --coverage")
env.Depends(covcmd, jsconvcopy)
env.AlwaysBuild(covcmd)
"""

# Targets
#env.Alias('coverage', covcmd)
#env.Alias('cov', 'coverage')
env.Alias('download-deps', download_dependencies)

targets = []
env.Default(targets)
