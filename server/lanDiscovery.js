const dgram = require('dgram');
const os = require('os');

const BROADCAST_PORT = 41234;
const BROADCAST_INTERVAL = 5000;   // 广播间隔 5 秒
const DEVICE_TIMEOUT = 15000;      // 设备超时 15 秒

// 局域网设备列表：Map<deviceKey, { ip, port, hostname, userCount, lastSeen }>
const lanDevices = new Map();

let socket = null;
let broadcastTimer = null;
let cleanupTimer = null;
let started = false;

// 获取本机所有 IPv4 地址（排除回环）
function getLocalIPs() {
  const ips = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

// 获取本机主机名
function getHostname() {
  try {
    return os.hostname() || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * 初始化局域网发现服务
 * @param {Object} opts - { getOnlineUserCount: () => number }
 */
function initLanDiscovery(opts = {}) {
  if (started) return;
  started = true;

  const localIPs = new Set(getLocalIPs());
  const hostname = getHostname();

  socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

  socket.on('message', (buf, rinfo) => {
    try {
      const msg = JSON.parse(buf.toString());
      if (msg.type !== 'sdd-announce') return;

      // 排除本机（IP 匹配或 hostname+port 匹配）
      if (localIPs.has(rinfo.address)) return;
      if (msg.hostname === hostname && msg.port === (opts.port || 3001)) return;

      const deviceKey = `${rinfo.address}:${msg.port}`;
      lanDevices.set(deviceKey, {
        ip: rinfo.address,
        port: msg.port,
        hostname: msg.hostname || 'unknown',
        userCount: msg.userCount || 0,
        lastSeen: Date.now(),
      });
    } catch (e) {
      // 忽略解析错误
    }
  });

  socket.on('error', (err) => {
    console.error('局域网发现服务错误:', err.message);
  });

  socket.bind(BROADCAST_PORT, () => {
    socket.setBroadcast(true);
    console.log(`局域网发现服务已启动，广播端口: ${BROADCAST_PORT}`);

    // 定期广播自己的存在
    const broadcast = () => {
      const announce = JSON.stringify({
        type: 'sdd-announce',
        hostname,
        port: opts.port || 3001,
        userCount: typeof opts.getOnlineUserCount === 'function' ? opts.getOnlineUserCount() : 0,
        timestamp: Date.now(),
      });
      const buf = Buffer.from(announce);
      // 向广播地址发送
      socket.send(buf, 0, buf.length, BROADCAST_PORT, '255.255.255.255', (err) => {
        if (err) console.error('广播发送失败:', err.message);
      });
    };

    // 立即广播一次，然后定期广播
    broadcast();
    broadcastTimer = setInterval(broadcast, BROADCAST_INTERVAL);

    // 定期清理超时设备
    cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, device] of lanDevices) {
        if (now - device.lastSeen > DEVICE_TIMEOUT) {
          lanDevices.delete(key);
        }
      }
    }, BROADCAST_INTERVAL);
  });
}

/**
 * 获取检测到的局域网设备列表
 */
function getLanDevices() {
  const now = Date.now();
  const devices = [];
  for (const device of lanDevices.values()) {
    devices.push({
      ip: device.ip,
      port: device.port,
      hostname: device.hostname,
      userCount: device.userCount,
      lastSeen: device.lastSeen,
      ageSec: Math.floor((now - device.lastSeen) / 1000),
    });
  }
  return devices;
}

/**
 * 获取局域网设备数
 */
function getLanDeviceCount() {
  return lanDevices.size;
}

module.exports = {
  initLanDiscovery,
  getLanDevices,
  getLanDeviceCount,
};
