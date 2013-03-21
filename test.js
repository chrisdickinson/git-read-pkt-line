var test = require('tape')
  , send = require('./index')
  , Buffer = require('buffer').Buffer

test('works as expected', function(assert) {
  var stream = send()
    , idx = 0
    , expect
    , data
      
  data = [
      '0007hi\n'
    , '0032want 0000000000000000000000000000000000000000\n'
    , '0000'
    , '001bhi\0ofs-delta hat party\n'
    , 'PACK0123456678999'
  ]
  expect = [
      {channel:0, size:3, data:'hi\n', type:'pkt-line', caps:null}
    , {channel:0, size:0x2e, data:'want 0000000000000000000000000000000000000000\n', type:'pkt-line', caps:null}
    , {channel:0, size:0, data:null, type:'pkt-flush', caps:null}
    , {channel:0, size:3, data:'hi\n', type:'pkt-line', caps:['ofs-delta', 'hat', 'party']}
    , {channel:0, size:4, data:'PACK', type:'packfile', caps:['ofs-delta', 'hat', 'party']}
    , {channel:0, size:13, data:'0123456678999', type:'packfile', caps:['ofs-delta', 'hat', 'party']}
  ]


  stream.on('data', function(d) {
    d.data = d.data === null ? d.data : d.data+''
    assert.deepEqual(d, expect[idx++]) 
  })

  do {
    stream.write(new Buffer(data[idx], 'utf8'))
  } while(idx !== expect.length)
  assert.end()
})
