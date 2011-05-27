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

from utils import download_file, get_file_list, get_tar_bin_path

cwd = os.getcwd()

opts = Variables('build.py')

opts.Add('node_tarball_url', default = '', help = 'URL to the Node tarball')

AddOption(
  '--docs-path',
  dest = 'docs_path',
  action = 'store',
  nargs = 1,
  metavar = 'PATH',
  help = 'Path where the latest API docs will be moved to'
)

AddOption(
  '--files',
  dest = 'js_files',
  action = 'store',
  nargs = 1,
  metavar = 'FILES',
  help = 'A list of JavaScript files'
)

AddOption(
  '--no-deps',
  dest = 'no_deps',
  action = 'store_true',
  help = 'Don\'t download dependencies when creating a distribution tarball'
)

env = Environment(options=opts,
                  ENV = os.environ.copy(),
                  tools = ['default', 'packaging'])

tar_bin_path = get_tar_bin_path(where_is_func=env.WhereIs)

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
conf.env['CAST_ROOT'] = Dir('#').abspath
conf.env['CAST_LIB'] = "${CAST_ROOT}/lib"
conf.env['CAST_EXTERN'] = "${CAST_LIB}/extern"
conf.env['WHISKEY'] = "NODE_PATH='${CAST_LIB}' ${NODE} 'node_modules/whiskey/bin/whiskey'"
conf.env.AppendUnique(RPATH = conf.env.get('LIBPATH'))
env = conf.Finish()

Export("env")

source = SConscript("lib/SConscript")
testsource = env.Glob("tests/*.js") + env.Glob("tests/*/*.js")
dist_tests = env.Glob('tests/dist/*.js');

allsource = testsource + source

no_deps = GetOption('no_deps')
js_files = GetOption('js_files')
if js_files:
  js_files = js_files.split(' ')

files_to_check = js_files or source

env["JSLINT"] = "NODE_PATH=lib/extern/ $NODE lib/extern/Nodelint/bin/jslint"
jslint = env.Command(".xjslint", files_to_check, ["$JSLINT "+ " ".join([str(x) for x in files_to_check])])

env.AlwaysBuild(jslint)
env.Alias('jslint', jslint)

lenv = env.Clone()

lenv["ENV"]["PYTHONPATH"] = lenv.Dir('lib/extern/closure-linter').get_path() + ":" + lenv["ENV"].get("PYTHONPATH", "")
lenv["GJSLINT"] = "python -m closure_linter.gjslint --strict"
lenv["GJSFIXSTYLE"] = "python -m closure_linter.fixjsstyle --strict"
gjslint = lenv.Command(".gjslint", source, ["$GJSLINT "+ " ".join([x.get_path() for x in source])])
gfixjsstyle = lenv.Command(".gfixjsstyle", source, ["$GJSFIXSTYLE "+ " ".join([x.get_path() for x in source])])

lenv.AlwaysBuild(gjslint)
lenv.Alias('gjslint', gjslint)
lenv.Alias('gfixjsstyle', gfixjsstyle)

# Generate API docs
cast_version = 'v%s' % (env['version_string'])

env['JSDOC'] = "java -jar lib/extern/jsdoc-toolkit/jsrun.jar lib/extern/jsdoc-toolkit/app/run.js -a -t=lib/extern/jsdoc-toolkit/templates/codeview -D='title:Cast API Docs %s' -d=%s/" % (tuple(2 * [cast_version]))
docscmd = env.Command('.builddocs', allsource, "$JSDOC " + " ".join([x.get_path() for x in source]))
env.Alias('docs', docscmd)

# Move API docs
docs_path = GetOption('docs_path')
copycmd = env.Command('.movedocs', allsource, 'cp -r %s/ %s/' % (cast_version, docs_path))
env.Alias('copy-docs', copycmd)

uploaddocscmd = env.Command('.uploaddocs', '',
                            'git checkout gh-pages; '+
                            ' git add jsdoc/*; ' +
                            'git commit -m "Re-build documentation"; ' +
                            #'git push origin gh-pages;' +
                            'git checkout master')
env.Alias('upload-docs', uploaddocscmd)
env.Alias('build-docs', [ docscmd, uploaddocscmd ])
env.Depends(uploaddocscmd, docscmd)

IGNORED_TESTS = [ 'tests/assert.js', 'tests/init.js', 'tests/init-dist.js',
                  'tests/common.js', 'tests/constants.js', 'tests/helpers.js',
                  'tests/data/', 'tests/dist/' ];
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

tests_to_run = ARGUMENTS.get('tests', None)

if tests_to_run:
  tests_to_run = tests_to_run.split(' ')
else:
  tests_to_run = test_files

chdir = pjoin(os.getcwd(), 'tests')
init_file = pjoin(os.getcwd(), 'tests', 'init.js')
assert_module_path = pjoin(os.getcwd(), 'tests', 'assert.js')
tests = os.environ.get('TEST_FILE') if os.environ.get('TEST_FILE') else ' '.join(tests_to_run)
output = '--print-stdout --print-stderr' if os.environ.get('OUTPUT') else ''
timeout = os.environ.get('TIMEOUT', 10000)
testcmd = env.Command('.tests_run', [], "$WHISKEY --timeout %s %s --chdir '%s' --custom-assert-module '%s' --test-init-file '%s' --tests '%s'" %
                      (timeout, output, chdir, assert_module_path, init_file, tests))

coveragecmd = env.Command('.tests_coverage', [], "$WHISKEY --timeout %s --chdir '%s' --custom-assert-module '%s' --test-init-file '%s' " \
                                             "--tests '%s' --coverage --coverage-reporter html --coverage-dir coverage_html " \
                                             "--coverage-encoding utf8 --coverage-exclude extern" %
                      (timeout, chdir, assert_module_path, init_file, ' '.join(tests_to_run)))


chdir = pjoin(os.getcwd())
init_file = pjoin(os.getcwd(), 'tests', 'init-dist.js')
dist_tests_to_run = [ test.get_path() for test in dist_tests ]
testcmd_dist = env.Command('.tests_dist_run', [], "$WHISKEY --timeout 180000 --chdir '%s' --test-init-file '%s' --tests '%s'" %
                           (chdir, init_file, ' '.join(dist_tests_to_run)))

env.AlwaysBuild(testcmd)
env.AlwaysBuild(coveragecmd)
env.Alias('test', testcmd)
env.Alias('tests', 'test')
env.Alias('test-dist', testcmd_dist)

env.Alias('coverage', coveragecmd)
env.Alias('cov', 'coverage')

# Update NPM dependencies
update_dependencies_cmd = env.Command('.update_dependencies', [], "rm -rf node_modules ; npm install")
env.AlwaysBuild(update_dependencies_cmd)
env.Alias('update-dependencies', update_dependencies_cmd)
env.Alias('update-deps', 'update-dependencies')

# Create a distribution tarball
dependencies = [
  [ env['node_tarball_url'], 'deps/node.tar.gz' ],
]

download_dependencies  = [ env.Command('.mkdir_deps', [], 'rm -rf deps ; mkdir deps')]
dependency_paths = [ 'deps/node.tar.gz' ]
for dependency in dependencies:
  download_dependencies.append((env.Command('.%s' % (dependency[1]), '', download_file(dependency[0], dependency[1]))))

paths_to_include = [ 'bin', 'lib', 'node_modules', 'other', 'deps']
files_to_include = [ 'SConstruct', 'README', 'NOTICE',
                     'LICENSE', 'CHANGES' ]
paths_to_skip = [  'lib/extern/Nodelint',
                  'lib/extern/jsdoc-toolkit', 'lib/extern/closure-linter',
                  'lib/extern/node-jscoverage',
                  'node_modules/.npm/',
                  'node_modules/whiskey',
                  'node_modules/nodelint',
                  'node_modules/.bin/',
                  'lib/SConscript',
                  'other/SConstruct',
                  'other/docgen.js']
files_to_pack = get_file_list(cwd, paths_to_include, paths_to_skip)
build_to_pack = [ pjoin('build', path) for path in files_to_pack +
                  files_to_include ]

package = env.Package(
  PACKAGEROOT = '.',
  NAME = 'cast',
  VERSION = env['version_string'],
  PACKAGETYPE = 'src_targz',
  LICENSE = 'Apache 2.0',
  source =  build_to_pack,
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

folder_name = 'cast-%s' % (env['version_string'])
tarball_name = '%s.tar.gz' % (folder_name)

# Calculate distribution tarball md5sum
calculate_md5sum = env.Command('.calculate_md5sum', [],
                                'md5sum dist/%s | awk \'{gsub("dist/", "", $0); print $0}\' > dist/%s.md5sum' % (tarball_name, tarball_name))

copy_paths = [ 'cp -R %s build' % (path) for path in paths_to_include +
               files_to_include ]
create_tarball = '%s -zc -f dist/%s --transform \'s,^build,%s,\' %s' % (
                  tar_bin_path, '%s' % (tarball_name),
                  folder_name, ' '.join(build_to_pack))
create_distribution_commands = [
                                 'rm -rf dist',
                                 'mkdir dist',
                                 'rm -rf build',
                                 'mkdir build']
create_distribution_commands.extend(copy_paths)
create_distribution_commands.extend(['cp other/SConstruct build/SConstruct'])
create_distribution_commands.extend([create_tarball])
create_distribution_commands.extend(['rm -rf build'])
create_distribution_tarball = env.Command('.create-dist', [],
                                          ' ; '.join(create_distribution_commands))

dist_targets = [ create_distribution_tarball, calculate_md5sum ]

if not no_deps:
  Depends(create_distribution_tarball, download_dependencies)
  dist_targets.insert(0, download_dependencies)

Depends(calculate_md5sum, create_distribution_tarball)

env.Alias('download-deps', download_dependencies)
env.Alias('dist', dist_targets)

targets = []
env.Default(targets)
