'use strict';

import assert from 'assert';
import gpuMock from 'gpu-mock.js';
import { predict, learnFilters, learnInputs } from '../../src/layer/fully-connected';

describe('FullyConnected Layer', () => {
  describe('.predict (forward propagation)', () => {
    it('can convolution a simple matrix', () => {
      const results = gpuMock(predict, {
        output: [9],
        constants: {
          inputDepth: 1,
          inputHeight: 1,
          inputWidth: 9
        }
      })([[0,1,2,3,4,5,6,7,8]], [
        [0,1,2,3,4,5,6,7,8],
        [0,1,2,3,4,5,6,7,8],
        [0,1,2,3,4,5,6,7,8],
        [0,1,2,3,4,5,6,7,8],
        [0,1,2,3,4,5,6,7,8],
        [0,1,2,3,4,5,6,7,8],
        [0,1,2,3,4,5,6,7,8],
        [0,1,2,3,4,5,6,7,8],
        [0,1,2,3,4,5,6,7,8]
      ], [0,1,2,3,4,5,6,7,8]);
      assert.deepEqual(results, [204,205,206,207,208,209,210,211,212]);
    });
  });

  describe('.learnFilters (back propagation)', () => {
    it('can convolution a simple matrix', () => {
      const inputs = [
        [0,1,2,3,4,5,6,7,8]
      ];
      const outputs = [
        0,1,2,
        3,4,5,
        6,7,8
      ];
      const results = gpuMock(learnFilters, {
        output: [9,9],
        constants: {
          inputWidth: 9,
          inputHeight: 1,
          inputDepth: 1
        }
      })(inputs, outputs);

      assert.deepEqual(results, [
        [0,0, 0, 0, 0, 0, 0, 0, 0],
        [0,1, 2, 3, 4, 5, 6, 7, 8],
        [0,2, 4, 6, 8,10,12,14,16],
        [0,3, 6, 9,12,15,18,21,24],
        [0,4, 8,12,16,20,24,28,32],
        [0,5,10,15,20,25,30,35,40],
        [0,6,12,18,24,30,36,42,48],
        [0,7,14,21,28,35,42,49,56],
        [0,8,16,24,32,40,48,56,64]
      ]);
    });
  });

  describe('.learnInputs (back propagation)', () => {
    it('can convolution a simple matrix', () => {
      const filters = [
        [0,1,2,3,4,5,6,7,8],
        [0,1,2,3,4,5,6,7,8],
        [0,1,2,3,4,5,6,7,8],
        [0,1,2,3,4,5,6,7,8],
        [0,1,2,3,4,5,6,7,8],
        [0,1,2,3,4,5,6,7,8],
        [0,1,2,3,4,5,6,7,8],
        [0,1,2,3,4,5,6,7,8],
        [0,1,2,3,4,5,6,7,8],
      ];
      const outputs = [
        0,1,2,
        3,4,5,
        6,7,8
      ];
      const results = gpuMock(learnInputs, {
        output: [9],
        constants: {
          inputWidth: 9,
          inputHeight: 1,
          inputDepth: 1
        }
      })(filters, outputs);

      assert.deepEqual(results, [0,36,72,108,144,180,216,252,288]);
    });
  });
});