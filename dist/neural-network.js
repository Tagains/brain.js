'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lookup = require('./lookup');

var _lookup2 = _interopRequireDefault(_lookup);

var _trainStream = require('./train-stream');

var _trainStream2 = _interopRequireDefault(_trainStream);

var _max = require('./utilities/max');

var _max2 = _interopRequireDefault(_max);

var _mse = require('./utilities/mse');

var _mse2 = _interopRequireDefault(_mse);

var _randos = require('./utilities/randos');

var _randos2 = _interopRequireDefault(_randos);

var _range = require('./utilities/range');

var _range2 = _interopRequireDefault(_range);

var _toArray = require('./utilities/to-array');

var _toArray2 = _interopRequireDefault(_toArray);

var _zeros = require('./utilities/zeros');

var _zeros2 = _interopRequireDefault(_zeros);

var _thaw = require('thaw.js');

var _thaw2 = _interopRequireDefault(_thaw);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * @param {object} options
 * @constructor
 */
var NeuralNetwork = function () {
  _createClass(NeuralNetwork, null, [{
    key: 'trainDefaults',
    get: function get() {
      return {
        iterations: 20000, // the maximum times to iterate the training data
        errorThresh: 0.005, // the acceptable error percentage from training data
        log: false, // true to use console.log, when a function is supplied it is used
        logPeriod: 10, // iterations between logging out
        learningRate: 0.3, // multiply's against the input and the delta then adds to momentum
        momentum: 0.1, // multiply's against the specified "change" then adds to learning rate for change
        callback: null, // a periodic call back that can be triggered while training
        callbackPeriod: 10, // the number of iterations through the training data between callback calls
        timeout: Infinity // the max number of milliseconds to train for
      };
    }
  }, {
    key: 'defaults',
    get: function get() {
      return {
        binaryThresh: 0.5, // ¯\_(ツ)_/¯
        hiddenLayers: [3], // array of ints for the sizes of the hidden layers in the network
        activation: 'sigmoid' // Supported activation types ['sigmoid', 'relu', 'leaky-relu', 'tanh']
      };
    }
  }]);

  function NeuralNetwork() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, NeuralNetwork);

    Object.assign(this, this.constructor.defaults, options);
    this.hiddenSizes = options.hiddenLayers;
    this.trainOpts = {};
    this.updateTrainingOptions(Object.assign({}, this.constructor.trainDefaults, options));

    this.sizes = null;
    this.outputLayer = null;
    this.biases = null; // weights for bias nodes
    this.weights = null;
    this.outputs = null;

    // state for training
    this.deltas = null;
    this.changes = null; // for momentum
    this.errors = null;

    if (!this.constructor.prototype.hasOwnProperty('runInput')) {
      this.runInput = null;
    }
    if (!this.constructor.prototype.hasOwnProperty('calculateDeltas')) {
      this.calculateDeltas = null;
    }
  }

  /**
   *
   * Expects this.sizes to have been set
   */


  _createClass(NeuralNetwork, [{
    key: '_initialize',
    value: function _initialize() {
      if (!this.sizes) throw new Error('Sizes must be set before initializing');

      this.outputLayer = this.sizes.length - 1;
      this.biases = []; // weights for bias nodes
      this.weights = [];
      this.outputs = [];

      // state for training
      this.deltas = [];
      this.changes = []; // for momentum
      this.errors = [];

      for (var layer = 0; layer <= this.outputLayer; layer++) {
        var size = this.sizes[layer];
        this.deltas[layer] = (0, _zeros2.default)(size);
        this.errors[layer] = (0, _zeros2.default)(size);
        this.outputs[layer] = (0, _zeros2.default)(size);

        if (layer > 0) {
          this.biases[layer] = (0, _randos2.default)(size);
          this.weights[layer] = new Array(size);
          this.changes[layer] = new Array(size);

          for (var node = 0; node < size; node++) {
            var prevSize = this.sizes[layer - 1];
            this.weights[layer][node] = (0, _randos2.default)(prevSize);
            this.changes[layer][node] = (0, _zeros2.default)(prevSize);
          }
        }
      }

      this.setActivation();
    }

    /**
     *
     * @param supported input: ['sigmoid', 'relu', 'leaky-relu', 'tanh']
     */

  }, {
    key: 'setActivation',
    value: function setActivation(activation) {
      this.activation = activation ? activation : this.activation;
      switch (this.activation) {
        case 'sigmoid':
          this.runInput = this.runInput || this.runInputSigmoid;
          this.calculateDeltas = this.calculateDeltas || this.calculateDeltasSigmoid;
          break;
        case 'relu':
          this.runInput = this.runInput || this.runInputRelu;
          this.calculateDeltas = this.calculateDeltas || this.calculateDeltasRelu;
          break;
        case 'leaky-relu':
          this.runInput = this.runInput || this.runInputLeakyRelu;
          this.calculateDeltas = this.calculateDeltas || this.calculateDeltasLeakyRelu;
          break;
        case 'tanh':
          this.runInput = this.runInput || this.runInputTanh;
          this.calculateDeltas = this.calculateDeltas || this.calculateDeltasTanh;
          break;
        default:
          throw new Error('unknown activation ' + this.activation);
      }
    }

    /**
     *
     * @param input
     * @returns {*}
     */

  }, {
    key: 'run',
    value: function run(input) {
      if (this.inputLookup) {
        input = _lookup2.default.toArray(this.inputLookup, input);
      }

      var output = [].concat(_toConsumableArray(this.runInput(input)));

      if (this.outputLookup) {
        output = _lookup2.default.toHash(this.outputLookup, output);
      }
      return output;
    }

    /**
     * trains via sigmoid
     * @param input
     * @returns {*}
     */

  }, {
    key: 'runInputSigmoid',
    value: function runInputSigmoid(input) {
      this.outputs[0] = input; // set output state of input layer

      var output = null;
      for (var layer = 1; layer <= this.outputLayer; layer++) {
        for (var node = 0; node < this.sizes[layer]; node++) {
          var weights = this.weights[layer][node];

          var sum = this.biases[layer][node];
          for (var k = 0; k < weights.length; k++) {
            sum += weights[k] * input[k];
          }
          //sigmoid
          this.outputs[layer][node] = 1 / (1 + Math.exp(-sum));
        }
        output = input = this.outputs[layer];
      }
      return output;
    }
  }, {
    key: 'runInputRelu',
    value: function runInputRelu(input) {
      this.outputs[0] = input; // set output state of input layer

      var output = null;
      for (var layer = 1; layer <= this.outputLayer; layer++) {
        for (var node = 0; node < this.sizes[layer]; node++) {
          var weights = this.weights[layer][node];

          var sum = this.biases[layer][node];
          for (var k = 0; k < weights.length; k++) {
            sum += weights[k] * input[k];
          }
          //relu
          this.outputs[layer][node] = sum < 0 ? 0 : sum;
        }
        output = input = this.outputs[layer];
      }
      return output;
    }
  }, {
    key: 'runInputLeakyRelu',
    value: function runInputLeakyRelu(input) {
      this.outputs[0] = input; // set output state of input layer

      var output = null;
      for (var layer = 1; layer <= this.outputLayer; layer++) {
        for (var node = 0; node < this.sizes[layer]; node++) {
          var weights = this.weights[layer][node];

          var sum = this.biases[layer][node];
          for (var k = 0; k < weights.length; k++) {
            sum += weights[k] * input[k];
          }
          //leaky relu
          this.outputs[layer][node] = sum < 0 ? 0 : 0.01 * sum;
        }
        output = input = this.outputs[layer];
      }
      return output;
    }
  }, {
    key: 'runInputTanh',
    value: function runInputTanh(input) {
      this.outputs[0] = input; // set output state of input layer

      var output = null;
      for (var layer = 1; layer <= this.outputLayer; layer++) {
        for (var node = 0; node < this.sizes[layer]; node++) {
          var weights = this.weights[layer][node];

          var sum = this.biases[layer][node];
          for (var k = 0; k < weights.length; k++) {
            sum += weights[k] * input[k];
          }
          //tanh
          this.outputs[layer][node] = Math.tanh(sum);
        }
        output = input = this.outputs[layer];
      }
      return output;
    }

    /**
     *
     * @param data
     * Verifies network sizes are initilaized
     * If they are not it will initialize them based off the data set.
     */

  }, {
    key: '_verifyIsInitialized',
    value: function _verifyIsInitialized(data) {
      var _this = this;

      if (this.sizes) return;

      this.sizes = [];
      this.sizes.push(data[0].input.length);
      if (!this.hiddenSizes) {
        this.sizes.push(Math.max(3, Math.floor(data[0].input.length / 2)));
      } else {
        this.hiddenSizes.forEach(function (size) {
          _this.sizes.push(size);
        });
      }
      this.sizes.push(data[0].output.length);

      this._initialize();
    }

    /**
     *
     * @param options
     *    Supports all `trainDefaults` properties
     *    also supports:
     *       learningRate: (number),
     *       momentum: (number),
     *       activation: ['sigmoid', 'relu', 'leaky-relu', 'tanh']
     */

  }, {
    key: 'updateTrainingOptions',
    value: function updateTrainingOptions(opts) {
      if (opts.iterations) {
        this.trainOpts.iterations = opts.iterations;
      }
      if (opts.errorThresh) {
        this.trainOpts.errorThresh = opts.errorThresh;
      }
      if (opts.log) {
        this._setLogMethod(opts.log);
      }
      if (opts.logPeriod) {
        this.trainOpts.logPeriod = opts.logPeriod;
      }
      if (opts.learningRate) {
        this.trainOpts.learningRate = opts.learningRate;
      }
      if (opts.momentum) {
        this.trainOpts.momentum = opts.momentum;
      }
      if (opts.callback) {
        this.trainOpts.callback = opts.callback;
      }
      if (opts.callbackPeriod) {
        this.trainOpts.callbackPeriod = opts.callbackPeriod;
      }
      if (opts.timeout) {
        this.trainOpts.timeout = opts.timeout;
      }
      if (opts.activation) {
        this.activation = opts.activation;
      }
    }

    /**
     *
     *  Gets JSON of trainOpts object
     *    NOTE: Activation is stored directly on JSON object and not in the training options
     */

  }, {
    key: '_getTrainOptsJSON',
    value: function _getTrainOptsJSON() {
      var results = {};
      if (this.trainOpts.iterations) {
        results.iterations = this.trainOpts.iterations;
      }
      if (this.trainOpts.errorThresh) {
        results.errorThresh = this.trainOpts.errorThresh;
      }
      if (this.trainOpts.logPeriod) {
        results.logPeriod = this.trainOpts.logPeriod;
      }
      if (this.trainOpts.learningRate) {
        results.learningRate = this.trainOpts.learningRate;
      }
      if (this.trainOpts.momentum) {
        results.momentum = this.trainOpts.momentum;
      }
      if (this.trainOpts.callback) {
        results.callback = this.trainOpts.callback;
      }
      if (this.trainOpts.callbackPeriod) {
        results.callbackPeriod = this.trainOpts.callbackPeriod;
      }
      if (this.trainOpts.timeout) {
        results.timeout = this.trainOpts.timeout;
      }
      if (this.trainOpts.log) {
        results.log = true;
      }
      return results;
    }

    /**
     *
     * @param log
     * if a method is passed in method is used
     * if false passed in nothing is logged
     * @returns error
     */

  }, {
    key: '_setLogMethod',
    value: function _setLogMethod(log) {
      if (typeof log === 'function') {
        this.trainOpts.log = log;
      } else if (log) {
        this.trainOpts.log = console.log;
      } else {
        this.trainOpts.log = false;
      }
    }

    /**
     *
     * @param data
     * @param learning Rate
     * @returns error
     */

  }, {
    key: '_calculateTrainingError',
    value: function _calculateTrainingError(data) {
      var sum = 0;
      for (var i = 0; i < data.length; ++i) {
        sum += this._trainPattern(data[i].input, data[i].output);
      }
      return sum / data.length;
    }

    /**
     *
     * @param status { iterations: number, error: number}
     * @param options
     */

  }, {
    key: '_trainingTick',
    value: function _trainingTick(data, status) {
      status.iterations++;
      status.error = this._calculateTrainingError(data);

      if (this.trainOpts.log && status.iterations % this.trainOpts.logPeriod === 0) {
        this.trainOpts.log('iterations: ' + status.iterations + ', training error: ' + status.error);
      }

      if (this.trainOpts.callback && status.iterations % this.trainOpts.callbackPeriod === 0) {
        this.trainOpts.callback(Object.assign(status));
      }
    }

    /**
     *
     * @param data
     * @param options
     * @returns {{error: number, iterations: number}}
     */

  }, {
    key: 'train',
    value: function train(data) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      this.updateTrainingOptions(options);
      data = this.formatData(data);
      var endTime = Date.now() + this.trainOpts.timeout;

      var status = {
        error: 1,
        iterations: 0
      };

      this._verifyIsInitialized(data);

      while (status.iterations < this.trainOpts.iterations && status.error > this.trainOpts.errorThresh && Date.now() < endTime) {
        this._trainingTick(data, status);
      }

      return status;
    }

    /**
     *
     * @param data
     * @param options
     * @param cb
     * @returns {{error: number, iterations: number}}
     */

  }, {
    key: 'trainAsync',
    value: function trainAsync(data) {
      var _this2 = this;

      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      return new Promise(function (resolve, reject) {
        _this2.updateTrainingOptions(options);
        data = _this2.formatData(data);
        var endTime = Date.now() + _this2.trainOpts.timeout;

        var status = {
          error: 1,
          iterations: 0
        };

        _this2._verifyIsInitialized(data);

        var items = new Array(_this2.trainOpts.iterations);
        var thaw = new _thaw2.default(items, {
          delay: true,
          each: function each() {
            _this2._trainingTick(data, status);
            if (status.error < _this2.trainOpts.errorThresh || Date.now() > endTime) {
              thaw.stop();
            }
          },
          done: function done() {
            resolve(status);
          }
        });

        thaw.tick();
      });
    }

    /**
     *
     * @param input
     * @param target
     */

  }, {
    key: '_trainPattern',
    value: function _trainPattern(input, target) {

      // forward propagate
      this.runInput(input);

      // back propagate
      this.calculateDeltas(target);
      this.adjustWeights();

      var error = (0, _mse2.default)(this.errors[this.outputLayer]);
      return error;
    }

    /**
     *
     * @param target
     */

  }, {
    key: 'calculateDeltasSigmoid',
    value: function calculateDeltasSigmoid(target) {
      for (var layer = this.outputLayer; layer >= 0; layer--) {
        for (var node = 0; node < this.sizes[layer]; node++) {
          var output = this.outputs[layer][node];

          var error = 0;
          if (layer === this.outputLayer) {
            error = target[node] - output;
          } else {
            var deltas = this.deltas[layer + 1];
            for (var k = 0; k < deltas.length; k++) {
              error += deltas[k] * this.weights[layer + 1][k][node];
            }
          }
          this.errors[layer][node] = error;
          this.deltas[layer][node] = error * output * (1 - output);
        }
      }
    }

    /**
     *
     * @param target
     */

  }, {
    key: 'calculateDeltasRelu',
    value: function calculateDeltasRelu(target) {
      for (var layer = this.outputLayer; layer >= 0; layer--) {
        for (var node = 0; node < this.sizes[layer]; node++) {
          var output = this.outputs[layer][node];

          var error = 0;
          if (layer === this.outputLayer) {
            error = target[node] - output;
          } else {
            var deltas = this.deltas[layer + 1];
            for (var k = 0; k < deltas.length; k++) {
              error += deltas[k] * this.weights[layer + 1][k][node];
            }
          }
          this.errors[layer][node] = error;
          this.deltas[layer][node] = output > 0 ? error : 0;
        }
      }
    }

    /**
     *
     * @param target
     */

  }, {
    key: 'calculateDeltasLeakyRelu',
    value: function calculateDeltasLeakyRelu(target) {
      for (var layer = this.outputLayer; layer >= 0; layer--) {
        for (var node = 0; node < this.sizes[layer]; node++) {
          var output = this.outputs[layer][node];

          var error = 0;
          if (layer === this.outputLayer) {
            error = target[node] - output;
          } else {
            var deltas = this.deltas[layer + 1];
            for (var k = 0; k < deltas.length; k++) {
              error += deltas[k] * this.weights[layer + 1][k][node];
            }
          }
          this.errors[layer][node] = error;
          this.deltas[layer][node] = output > 0 ? error : 0.01 * error;
        }
      }
    }

    /**
     *
     * @param target
     */

  }, {
    key: 'calculateDeltasTanh',
    value: function calculateDeltasTanh(target) {
      for (var layer = this.outputLayer; layer >= 0; layer--) {
        for (var node = 0; node < this.sizes[layer]; node++) {
          var output = this.outputs[layer][node];

          var error = 0;
          if (layer === this.outputLayer) {
            error = target[node] - output;
          } else {
            var deltas = this.deltas[layer + 1];
            for (var k = 0; k < deltas.length; k++) {
              error += deltas[k] * this.weights[layer + 1][k][node];
            }
          }
          this.errors[layer][node] = error;
          this.deltas[layer][node] = (1 - output * output) * error;
        }
      }
    }

    /**
     *
     * Changes weights of networks
     */

  }, {
    key: 'adjustWeights',
    value: function adjustWeights() {
      for (var layer = 1; layer <= this.outputLayer; layer++) {
        var incoming = this.outputs[layer - 1];

        for (var node = 0; node < this.sizes[layer]; node++) {
          var delta = this.deltas[layer][node];

          for (var k = 0; k < incoming.length; k++) {
            var change = this.changes[layer][node][k];

            change = this.trainOpts.learningRate * delta * incoming[k] + this.trainOpts.momentum * change;

            this.changes[layer][node][k] = change;
            this.weights[layer][node][k] += change;
          }
          this.biases[layer][node] += this.trainOpts.learningRate * delta;
        }
      }
    }

    /**
     *
     * @param data
     * @returns {*}
     */

  }, {
    key: 'formatData',
    value: function formatData(data) {
      var _this3 = this;

      if (!Array.isArray(data)) {
        // turn stream datum into array
        var tmp = [];
        tmp.push(data);
        data = tmp;
      }
      // turn sparse hash input into arrays with 0s as filler
      var datum = data[0].input;
      if (!Array.isArray(datum) && !(datum instanceof Float32Array)) {
        if (!this.inputLookup) {
          this.inputLookup = _lookup2.default.buildLookup(data.map(function (value) {
            return value['input'];
          }));
        }
        data = data.map(function (datum) {
          var array = _lookup2.default.toArray(_this3.inputLookup, datum.input);
          return Object.assign({}, datum, { input: array });
        }, this);
      }

      if (!Array.isArray(data[0].output)) {
        if (!this.outputLookup) {
          this.outputLookup = _lookup2.default.buildLookup(data.map(function (value) {
            return value['output'];
          }));
        }
        data = data.map(function (datum) {
          var array = _lookup2.default.toArray(_this3.outputLookup, datum.output);
          return Object.assign({}, datum, { output: array });
        }, this);
      }
      return data;
    }

    /**
     *
     * @param data
     * @returns {
     *  {
     *    error: number,
     *    misclasses: Array
     *  }
     * }
     */

  }, {
    key: 'test',
    value: function test(data) {
      var _this4 = this;

      data = this.formatData(data);

      // for binary classification problems with one output node
      var isBinary = data[0].output.length === 1;
      var falsePos = 0;
      var falseNeg = 0;
      var truePos = 0;
      var trueNeg = 0;

      // for classification problems
      var misclasses = [];

      // run each pattern through the trained network and collect
      // error and misclassification statistics
      var sum = 0;

      var _loop = function _loop(i) {
        var output = _this4.runInput(data[i].input);
        var target = data[i].output;

        var actual = void 0,
            expected = void 0;
        if (isBinary) {
          actual = output[0] > _this4.binaryThresh ? 1 : 0;
          expected = target[0];
        } else {
          actual = output.indexOf((0, _max2.default)(output));
          expected = target.indexOf((0, _max2.default)(target));
        }

        if (actual !== expected) {
          var misclass = data[i];
          Object.assign(misclass, {
            actual: actual,
            expected: expected
          });
          misclasses.push(misclass);
        }

        if (isBinary) {
          if (actual === 0 && expected === 0) {
            trueNeg++;
          } else if (actual === 1 && expected === 1) {
            truePos++;
          } else if (actual === 0 && expected === 1) {
            falseNeg++;
          } else if (actual === 1 && expected === 0) {
            falsePos++;
          }
        }

        var errors = output.map(function (value, i) {
          return target[i] - value;
        });
        sum += (0, _mse2.default)(errors);
      };

      for (var i = 0; i < data.length; i++) {
        _loop(i);
      }
      var error = sum / data.length;

      var stats = {
        error: error,
        misclasses: misclasses
      };

      if (isBinary) {
        Object.assign(stats, {
          trueNeg: trueNeg,
          truePos: truePos,
          falseNeg: falseNeg,
          falsePos: falsePos,
          total: data.length,
          precision: truePos / (truePos + falsePos),
          recall: truePos / (truePos + falseNeg),
          accuracy: (trueNeg + truePos) / data.length
        });
      }
      return stats;
    }

    /**
     *
     * @returns
     *  {
     *    layers: [
     *      {
     *        x: {},
     *        y: {}
     *      },
     *      {
     *        '0': {
     *          bias: -0.98771313,
     *          weights: {
     *            x: 0.8374838,
     *            y: 1.245858
     *          },
     *        '1': {
     *          bias: 3.48192004,
     *          weights: {
     *            x: 1.7825821,
     *            y: -2.67899
     *          }
     *        }
     *      },
     *      {
     *        f: {
     *          bias: 0.27205739,
     *          weights: {
     *            '0': 1.3161821,
     *            '1': 2.00436
     *          }
     *        }
     *      }
     *    ]
     *  }
     */

  }, {
    key: 'toJSON',
    value: function toJSON() {
      var layers = [];
      for (var layer = 0; layer <= this.outputLayer; layer++) {
        layers[layer] = {};

        var nodes = void 0;
        // turn any internal arrays back into hashes for readable json
        if (layer === 0 && this.inputLookup) {
          nodes = Object.keys(this.inputLookup);
        } else if (layer === this.outputLayer && this.outputLookup) {
          nodes = Object.keys(this.outputLookup);
        } else {
          nodes = (0, _range2.default)(0, this.sizes[layer]);
        }

        for (var j = 0; j < nodes.length; j++) {
          var node = nodes[j];
          layers[layer][node] = {};

          if (layer > 0) {
            layers[layer][node].bias = this.biases[layer][j];
            layers[layer][node].weights = {};
            for (var k in layers[layer - 1]) {
              var index = k;
              if (layer === 1 && this.inputLookup) {
                index = this.inputLookup[k];
              }
              layers[layer][node].weights[k] = this.weights[layer][j][index];
            }
          }
        }
      }
      return {
        sizes: this.sizes,
        layers: layers,
        outputLookup: !!this.outputLookup,
        inputLookup: !!this.inputLookup,
        activation: this.activation,
        trainOpts: this._getTrainOptsJSON()
      };
    }

    /**
     *
     * @param json
     * @returns {NeuralNetwork}
     */

  }, {
    key: 'fromJSON',
    value: function fromJSON(json) {
      this.sizes = json.sizes;
      this._initialize();

      for (var i = 0; i <= this.outputLayer; i++) {
        var layer = json.layers[i];
        if (i === 0 && (!layer[0] || json.inputLookup)) {
          this.inputLookup = _lookup2.default.lookupFromHash(layer);
        } else if (i === this.outputLayer && (!layer[0] || json.outputLookup)) {
          this.outputLookup = _lookup2.default.lookupFromHash(layer);
        }
        if (i > 0) {
          var nodes = Object.keys(layer);
          this.sizes[i] = nodes.length;
          for (var j in nodes) {
            var node = nodes[j];
            this.biases[i][j] = layer[node].bias;
            this.weights[i][j] = (0, _toArray2.default)(layer[node].weights);
          }
        }
      }
      this.updateTrainingOptions(json.trainOpts);
      this.setActivation();
      return this;
    }

    /**
     *
     * @returns {Function}
     */

  }, {
    key: 'toFunction',
    value: function toFunction() {
      var activation = this.activation;
      function nodeHandle(layers, layerNumber, nodeKey) {
        if (layerNumber === 0) {
          return typeof nodeKey === 'string' ? 'input[\'' + nodeKey + '\']' : 'input[' + nodeKey + ']';
        }

        var layer = layers[layerNumber];
        var node = layer[nodeKey];
        var result = [node.bias];
        for (var w in node.weights) {
          if (node.weights[w] < 0) {
            result.push(node.weights[w] + '*(' + nodeHandle(layers, layerNumber - 1, w) + ')');
          } else {
            result.push('+' + node.weights[w] + '*(' + nodeHandle(layers, layerNumber - 1, w) + ')');
          }
        }

        switch (activation) {
          case 'sigmoid':
            return '1/(1+1/Math.exp(' + result.join('') + '))';
          case 'relu':
            return 'var sum = ' + result.join('') + ';(sum < 0 ? 0 : sum);';
          case 'leaky-relu':
            return 'var sum = ' + result.join('') + ';(sum < 0 ? 0 : 0.01 * sum);';
          case 'tanh':
            return 'Math.tanh(' + result.join('') + ');';
          default:
            throw new Error('unknown activation type ' + activation);
        }
      }

      var layers = this.toJSON().layers;
      var layersAsMath = [];
      var result = void 0;
      for (var i in layers[layers.length - 1]) {
        layersAsMath.push(nodeHandle(layers, layers.length - 1, i));
      }
      if (this.outputLookup) {
        result = '{' + Object.keys(this.outputLookup).map(function (key, i) {
          return '\'' + key + '\':' + layersAsMath[i];
        }) + '}';
      } else {
        result = '[' + layersAsMath.join(',') + ']';
      }
      return new Function('input', 'return ' + result);
    }

    /**
     * This will create a TrainStream (WriteStream) for us to send the training data to.
     * @param opts training options
     * @returns {TrainStream|*}
     */

  }, {
    key: 'createTrainStream',
    value: function createTrainStream(opts) {
      opts = opts || {};
      opts.neuralNetwork = this;
      this.setActivation();
      this.trainStream = new _trainStream2.default(opts);
      return this.trainStream;
    }
  }]);

  return NeuralNetwork;
}();

exports.default = NeuralNetwork;
//# sourceMappingURL=neural-network.js.map