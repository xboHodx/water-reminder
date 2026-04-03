import test from 'node:test'
import assert from 'node:assert/strict'

import { filterImageFiles } from '../src/images'

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
