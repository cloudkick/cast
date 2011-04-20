#
# Copyright 2010, Cloudkick, Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

import os
import os.path
import shutil

from os.path import join as pjoin

# Taken from http://www.scons.org/wiki/AccumulateBuilder
def copytree(src, dest, symlinks=False):
    """My own copyTree which does not fail if the directory exists.

    Recursively copy a directory tree using copy2().

    If the optional symlinks flag is true, symbolic links in the
    source tree result in symbolic links in the destination tree; if
    it is false, the contents of the files pointed to by symbolic
    links are copied.

    Behavior is meant to be identical to GNU 'cp -R'.
    """
    def copyItems(src, dest, symlinks=False):
        """Function that does all the work.

        It is necessary to handle the two 'cp' cases:
        - destination does exist
        - destination does not exist

        See 'cp -R' documentation for more details
        """
        for item in os.listdir(src):
           srcPath = os.path.join(src, item)
           if os.path.isdir(srcPath):
               srcBasename = os.path.basename(srcPath)
               destDirPath = os.path.join(dest, srcBasename)
               if not os.path.exists(destDirPath):
                   os.makedirs(destDirPath)
               copyItems(srcPath, destDirPath)
           elif os.path.islink(item) and symlinks:
               linkto = os.readlink(item)
               os.symlink(linkto, dest)
           else:
               shutil.copy2(srcPath, dest)

    # case 'cp -R src/ dest/' where dest/ already exists
    if os.path.exists(dest):
       destPath = os.path.join(dest, os.path.basename(src))
       if not os.path.exists(destPath):
           os.makedirs(destPath)
    # case 'cp -R src/ dest/' where dest/ does not exist
    else:
       os.makedirs(dest)
       destPath = dest
    # actually copy the files
    copyItems(src, destPath)
    return None

def symlink(target, source, env):
  os.symlink(str(source[0]), str(target[0]))

def delete_path(path):
  if not os.path.exists(path):
    return

  if os.path.isdir(path):
    shutil.rmtree(path)
  else:
    os.unlink(path)

def delete_paths(target, source, env):
  for path in source:
    path = str(path)
    delete_path(path)
  return None

def copy_files(target, source, env):
  target = [str(t) for t in target]
  source = [str(s) for s in source]

  for index in range(0, len(target)):
    src = source[index]
    dest = target[index]
    shutil.copyfile(src, dest)

  return None

def copy_tree(target, source, env):
  target = str(target[0])
  source = [str(s) for s in source]

  # hack :-(
  if not target.startswith('/'):
    target = '/' + target

  if isinstance(source, (list, tuple)):
    for path in source:
      copytree(path, pjoin(target, path))
  else:
    copytree(source, target)

  return None

def get_runit_directory_name(base_path):
  files = os.listdir(base_path)

  for file in files:
    if file.startswith('runit'):
      return file

  return None
