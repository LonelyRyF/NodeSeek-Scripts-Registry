(function() {
    const API = window.NodeSeekUI;
    if (!API) {
        console.error('未检测到 UI 基座');
        return;
    }

    const MODULE_ID = 'ns_auto_sign';

    // 配置表单 Schema，只保留“碰运气”开关
    const SCHEMA = [
        {
            key: 'tryLuck',
            type: 'switch',
            label: '开启碰运气',
            description: '开启后签到将使用随机奖励模式，关闭则获得固定奖励。',
            default: true
        }
    ];

    // 核心签到逻辑
    async function doSignIn() {
        const today = new Date().toLocaleDateString();
        const storageKey = `last_sign_date_${location.hostname}`;
        const lastSignDate = API.load(MODULE_ID, storageKey, '');
        
        if (lastSignDate === today) {
            console.log(`[自动签到] ${location.hostname} 今日已签到，跳过请求。`);
            return;
        }

        const cfg = API.getConfig(MODULE_ID, SCHEMA);
        const isRandom = cfg.tryLuck ? 'true' : 'false';

        try {
            const apiUrl = `${location.origin}/api/attendance?random=${isRandom}`;

            // 替换为浏览器原生 fetch，携带默认 credentials 和原生指纹，防止触发 WAF 拦截
            const res = await fetch(apiUrl, {
                method: 'POST',
                // 确保携带同源 Cookie
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            // fetch 响应需要手动判断 HTTP 状态码
            if (!res.ok) {
                throw new Error(`HTTP 错误: ${res.status}`);
            }

            const data = await res.json();
            
            if (data.success) {
                API.showAlert(`签到成功：${data.message}`);
                // 成功后写入今天的日期
                API.store(MODULE_ID, storageKey, today);
            } else {
                // 接口提示已经签到过，则更新本地日期
                if (data.message && (data.message.includes('已经签到') || data.message.includes('已签到'))) {
                    API.store(MODULE_ID, storageKey, today);
                }
                console.log(`[自动签到] ${data.message}`);
            }
        } catch (error) {
            console.error('[自动签到] 请求异常，可能是网络原因或被风控拦截', error);
        }
    }

    // 注册到基座
    API.register({
        id: MODULE_ID,
        name: '自动签到',
        version: '1.0.2',
        description: '每天首次访问网页时自动完成签到，支持碰运气模式。使用原生请求防拦截。',
        
        render: function(container) {
            const currentConfig = API.getConfig(MODULE_ID, SCHEMA);
            const form = API.UI.buildConfigForm(SCHEMA, currentConfig, function(newConfig) {
                API.store(MODULE_ID, 'config', newConfig);
                doSignIn();
            });
            container.appendChild(form);
        },
        
        execute: function() {
            // 延时执行，避免阻塞页面渲染
            setTimeout(doSignIn, 2500);
        },
        
        onToggle: function(enabled) {
            if (enabled) {
                doSignIn();
            }
        }
    });
})();