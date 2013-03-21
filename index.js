module.exports = readline

var through = require('through')
  , Buffer = require('buffer').Buffer
  , SIZE = new Buffer(4)

var _ = 0
  , STATE_READY_CHANNEL = _++
  , STATE_READY = _++
  , STATE_RECV = _++
  , STATE_MAYBE_PACK = _++
  , STATE_PACK = _++

function readline() {
  var stream = through(write)
    , state = STATE_READY
    , expect = [1, 4, null, 4, Infinity]
    , capabilities = null
    , expect_size = 0
    , accum = []
    , got = 0

  return stream

  function write(buf) {
    if(state === STATE_PACK) {
      return queue_packdata(buf)
    }

    accum[accum.length] = buf
    got += buf.length
    if(got < expect[state]) {
      return
    }

    if(accum.length && state === STATE_MAYBE_PACK) {
      do_maybe_packs()
    }

    if(accum.length && state === STATE_READY) {
      do_size()
    }

    if(accum.length && state === STATE_RECV) {
      do_recv()
    }

    if(accum.length && state === STATE_PACK) {
      do_packs()
    }

    if(accum.length) {
      buf = Buffer.concat(accum)
      accum.length = 0
      write(buf)
    }
  }

  function do_maybe_packs() {
    // we're just peeking at the first four bytes
    var buf
    _fill(buf = new Buffer(expect[state]))
    accum.unshift(buf)
    got += expect[state]
    if(buf.toString() === 'PACK') {
      state = STATE_PACK
      return
    }
    state = STATE_READY
  }

  function do_size() {
    var buf
    _fill(buf = new Buffer(expect[state]))
    expect_size = parseInt(buf.toString(), 16)
    if(expect_size === 0) {
      stream.queue({
          type: 'pkt-flush'
        , data: null
        , size: 0
        , caps: capabilities
      })
      state = STATE_READY
      return
    }
    expect_size -= 4
    expect[STATE_RECV] = expect_size
    state = STATE_RECV
  }

  function do_recv() {
    var buf
    _fill(buf = new Buffer(expect[state]))

    if(!capabilities) {
      // we should see capabilities here.
      capabilities = divine_capabilities(buf)
      if(capabilities) {
        buf = buf.slice(0, capabilities.idx + 1)
        buf.writeUInt8(0x0a, buf.length - 1)
        capabilities = capabilities.caps
        expect_size = buf.length
      }
    }

    stream.queue({
        type: 'pkt-line'
      , data: buf
      , size: expect_size
      , caps: capabilities 
    })

    expect[STATE_RECV] = expect_size = null
    state = STATE_MAYBE_PACK
  }

  function do_packs() {
    // empty the accum into the stream
    while(accum.length) {
      queue_packdata(accum.shift())
    } 
  }

  function queue_packdata(buf) {
    stream.queue({
        type: 'packfile'
      , data: buf
      , size: buf.length
      , caps: capabilities 
    })
  }

  function _fill(current) {
    var num = current.length
      , buf = Buffer.concat(accum)
      , rest

    accum.length = 0
    buf.copy(current, 0, 0, num)

    if(num !== buf.length) {
      accum[0] = buf.slice(num)
    }
  } 
}

function divine_capabilities(buf) {
  for(var i = 0, len = buf.length; i < len; ++i) {
    if(buf.readUInt8(i) === 0) {
      break
    }
  }

  if(i === len) {
    return null
  }

  return {
      idx: i
    , caps: buf.slice(i+1, buf.length - 1).toString().split(' ')
  }
}
