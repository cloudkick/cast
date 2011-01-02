import os
import os.path
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
