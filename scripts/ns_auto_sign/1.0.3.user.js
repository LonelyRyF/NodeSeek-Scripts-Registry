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
        const errorCooldownKey = `last_error_time_${location.hostname}`;
        
        const lastSignDate = API.load(MODULE_ID, storageKey, '');
        if (lastSignDate === today) {
            // console.log(`[自动签到] ${location.hostname} 今日已处理，跳过。`);
            return;
        }

        // 错误冷却检测：如果上次报错距离现在不到1小时，跳过请求，防止无限 500 轰炸服务器
        const lastErrorTime = API.load(MODULE_ID, errorCooldownKey, 0);
        if (Date.now() - lastErrorTime < 3600 * 1000) {
            return;
        }

        const cfg = API.getConfig(MODULE_ID, SCHEMA);
        const isRandom = cfg.tryLuck ? 'true' : 'false';

        try {
            const apiUrl = `${location.origin}/api/attendance?random=${isRandom}`;

            // 使用原生 fetch，关键修复：必须带上 body: '{}'
            const res = await window.fetch(apiUrl, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: '{}' // 解决后端 JSON 解析器报 500 的核心
            });
            
            if (!res.ok) {
                throw new Error(`HTTP 错误: ${res.status}`);
            }

            const data = await res.json();
            
            if (data.success) {
                API.showAlert(`签到成功：${data.message}`);
                API.store(MODULE_ID, storageKey, today); // 成功，记录今天
            } else {
                // 接口提示已经签到过
                if (data.message && (data.message.includes('已经签到') || data.message.includes('已签到'))) {
                    API.store(MODULE_ID, storageKey, today); // 已签到，记录今天
                } else {
                    API.showAlert(`签到提示：${data.message}`);
                }
                console.log(`[自动签到] ${data.message}`);
            }
            
            // 运行成功，清除可能存在的错误冷却时间
            API.store(MODULE_ID, errorCooldownKey, 0);

        } catch (error) {
            console.error('[自动签到] 请求异常', error);
            // 记录报错时间，触发 1 小时冷却
            API.store(MODULE_ID, errorCooldownKey, Date.now());
        }
    }

    // 注册到基座
    API.register({
        id: MODULE_ID,
        name: '自动签到',
        version: '1.0.3',
        description: '每天首次访问网页时自动完成签到，支持碰运气模式。原生请求防拦截。',
        
        render: function(container) {
            const currentConfig = API.getConfig(MODULE_ID, SCHEMA);
            const form = API.UI.buildConfigForm(SCHEMA, currentConfig, function(newConfig) {
                API.store(MODULE_ID, 'config', newConfig);
                // 保存配置时，清除错误冷却状态，强制立即重试一次
                API.store(MODULE_ID, `last_error_time_${location.hostname}`, 0);
                doSignIn();
            });
            container.appendChild(form);
        },
        
        execute: function() {
            // 延时执行，避免阻塞页面核心渲染
            setTimeout(doSignIn, 2500);
        },
        
        onToggle: function(enabled) {
            if (enabled) {
                API.store(MODULE_ID, `last_error_time_${location.hostname}`, 0);
                doSignIn();
            }
        }
    });
})();