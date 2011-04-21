import os
import os.path
import hashlib
from os.path import join as pjoin

def download_file(source, target):
  return 'wget %s -O %s' % (source, target)

def get_file_list(base_path, include_list = None, exclude_list = None):
  if not isinstance(include_list, (list, tuple)):
    include_list = [ include_list ]

  if not exclude_list:
    exclude_list = []

  def is_included(file_path):
    for path in include_list:
      if file_path.find(path) == 0:
        return True
    return False

  def is_excluded(file_path):
    for path in exclude_list:
      if file_path.find(path) == 0:
        return True
    return False

  files = []
  for (dirpath, dirname, filenames) in os.walk(base_path):
    for file_name in filenames:
      file_path = pjoin(dirpath.replace('%s/' % (base_path), ''), file_name)

      if is_included(file_path) and not is_excluded(file_path):
        files.append(file_path)

  return files

def file_sum(file_path, hash_type='md5'):
  if hash not in [ 'sha1', 'md5' ]:
    raise ValueError('Invalid hash type: %s' % (hash_type))

  file_hash = getattr(hashlib, hash_type, None)
  with open(file_path, 'rb') as fp:
    content = fp.read()

  file_hash.update(content)
  return file_hash.hexdigest()

def get_tar_bin_path(where_is_func, possible_names=None):
  if not possible_names:
    possible_names = [ 'gnutar', 'gtar', 'tar' ]

  for binary in possible_names:
    binary_path = where_is_func(binary)

    if binary_path:
      return binary_path

  return None
