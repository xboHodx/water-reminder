import test from 'node:test'
import assert from 'node:assert/strict'

import { getImageMimeType, filterImageFiles } from '../src/images'

test('filterImageFiles keeps only supported image extensions', () => {
  assert.deepEqual(
    filterImageFiles(
      [
        '/tmp/a.png',
        '/tmp/b.JPG',
        '/tmp/c.txt',
        '/tmp/d.webp',
      ],
      ['.png', '.jpg', '.webp'],
    ),
    ['/tmp/a.png', '/tmp/b.JPG', '/tmp/d.webp'],
  )
})

test('getImageMimeType maps common file extensions', () => {
  assert.equal(getImageMimeType('/tmp/a.jpg'), 'image/jpeg')
  assert.equal(getImageMimeType('/tmp/b.png'), 'image/png')
  assert.equal(getImageMimeType('/tmp/c.webp'), 'image/webp')
  assert.equal(getImageMimeType('/tmp/d.unknown'), 'application/octet-stream')
})
