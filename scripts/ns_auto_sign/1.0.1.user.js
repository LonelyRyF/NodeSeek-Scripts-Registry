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
        // 加上当前域名作为缓存后缀，区分 NodeSeek 和 DeepFlood 的签到状态
        const storageKey = `last_sign_date_${location.hostname}`;
        const lastSignDate = API.load(MODULE_ID, storageKey, '');
        
        if (lastSignDate === today) {
            console.log(`[自动签到] ${location.hostname} 今日已签到，跳过请求。`);
            return;
        }

        const cfg = API.getConfig(MODULE_ID, SCHEMA);
        const isRandom = cfg.tryLuck ? 'true' : 'false';

        try {
            // 动态读取当前站点的 origin (如 https://www.nodeseek.com 或 https://www.deepflood.com)
            const apiUrl = `${location.origin}/api/attendance?random=${isRandom}`;

            // 发起签到请求
            const res = await API.request({
                url: apiUrl,
                method: 'POST', 
                headers: {
                    'accept': 'application/json',
                    'content-type': 'application/json'
                }
            });
            
            const data = JSON.parse(res.responseText);
            
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
            console.error('[自动签到] 请求异常', error);
        }
    }

    // 注册到基座
    API.register({
        id: MODULE_ID,
        name: '自动签到',
        version: '1.0.1',
        description: '每天首次访问网页时自动完成签到，支持碰运气模式。自动适配 NodeSeek 和 DeepFlood。',
        
        render: function(container) {
            const currentConfig = API.getConfig(MODULE_ID, SCHEMA);
            const form = API.UI.buildConfigForm(SCHEMA, currentConfig, function(newConfig) {
                API.store(MODULE_ID, 'config', newConfig);
                // 保存后顺便触发一次检查
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