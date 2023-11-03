import readline from 'readline'
import Corestore from 'corestore'
import Hyperswarm from 'hyperswarm'
import {nicknames} from 'memorable-moniker'

// NOTE: change topic during development to debug faster
const init = async ({topic = Buffer.alloc(32).fill('synonym-default5'), alias = nicknames.next() }) => {
  const io = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: `[${alias}]: ` })
  const swarm = new Hyperswarm()
  const store = new Corestore(`hypercore/alias-${alias}`)
  const me = store.get({ name: alias })
  await me.ready()

  swarm.on('connection',(async (conn) => {
    store.replicate(conn)
    conn.on('data', async (data) => {
      try {
        const {handshake, alias, key} = JSON.parse(data.toString())
        if(handshake) {
          const them = store.get({ key: Buffer.from(key, 'hex') })
          await them.ready()
          them.createReadStream({ live: true }).on('data', (e) => {
            process.stdout.write(`<${alias}> ${e.toString()}\n`)
          })
          await them.download({ start: 0, end: -1 })
        }
      }
      catch (e) {
        //ignore errors
      }
    })
    // exchange broadcast pubkey for hyperstore
    conn.write(JSON.stringify({alias, key: me.key.toString('hex'), handshake: true}))
  }))
  
  swarm.join(topic)
  
  io.on('line', async (line) => {
    process.stdout.write('\r\x1b[K')
    await me.append(Buffer.from(line))
  })
  
  io.on('close', async () => {
    console.log('Bye!')
    await swarm.destroy({ force: true })
    await me.session().close()
    await me.close()
  })

  return {io}
}

export default init
