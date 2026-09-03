/* ============================================================
   SkillMesh / 插台 — Internationalization (i18n)
   ============================================================ */

const I18N = {
  zh: {
    // Hero
    subtitle: "能力通约网络 — 让任何能力被任何调用方发现、评估和调用",

    // Search
    searchPlaceholder: "描述你需要的能力，例如：提取PDF表格",
    searchHint: "输入自然语言描述，实时匹配能力锚点",
    searching: "语义检索中…",

    // Category
    categoryAll: "全部",
    categoryAI: "AI 智能",
    categoryData: "数据处理",
    categoryMedia: "媒体处理",
    categoryLanguage: "语言服务",
    categoryDev: "开发工具",

    // Empty / Loading
    empty: "未找到匹配的能力锚点",
    emptySub: "尝试更换关键词或切换分类筛选",
    noData: "暂无能力数据",
    loading: "正在加载能力数据…",

    // Card
    calls: "次调用",

    // Modal
    desc: "描述",
    input: "输入参数",
    output: "输出承诺",
    endpoint: "调用端点",
    provenance: "来源链接",
    trust: "可信度向量",
    source: "源码可验证",
    usage: "使用痕迹",
    success: "成功率",
    risk: "依赖风险",
    time: "时效性",
    usageGuide: "使用说明",
    features: "功能特性",
    codeExample: "调用示例",

    // Evidence
    evidenceCount: "基于 {n} 次调用",
    uncertainty: "不确定性",
    newCapability: "新能力",

    // Routing
    routing: "路由操作",
    generateCode: "生成代码",
    tryIt: "浏览器试用",
    exportAdapter: "导出适配器",
    exportTo: "导出到",
    exportDSH: "DeepSeek-Harness (plugin.yaml)",
    exportMCP: "MCP 客户端 (mcp.json)",
    exportLangChain: "LangChain (Tool JSON)",
    exportCrewAI: "CrewAI (Tool Schema)",
    exportDify: "Dify (工具配置)",
    exportSelected: "导出选中",
    copyAll: "复制全部",
    copyCode: "复制代码",
    codeCopied: "已复制到剪贴板",
    tryItTitle: "浏览器端试用",
    tryItMethod: "请求方法",
    tryItParams: "请求参数",
    tryItHeaders: "请求头",
    tryItSend: "发送请求",
    tryItResponse: "响应结果",
    tryItStatus: "状态码",
    tryItTime: "耗时",
    tryItError: "请求失败",
    tryItOnlyHttp: "仅支持 HTTP 类型的能力端点",
    dshInstallHint: "在 DeepSeek-Harness 环境中执行以下命令安装",
    dshCliInstall: "通过 CLI 安装",
    dshUrlInstall: "通过 URL 安装",
    dshAdapterGenerated: "DSH 适配器配置已生成",

    // Auth
    login: "登录",
    logout: "退出",
    loginAs: "以 {name} 身份登录",
    authLoading: "验证中…",

    // Federation
    federation: "联邦网络",
    federatedSearch: "包含联邦节点",
    federatedSource: "联邦",
    federationNodes: "已知节点",
    federationNoNodes: "暂无联邦节点",
    federationAddNode: "添加节点",
    federationNodeId: "节点 ID",
    federationNodeName: "节点名称",
    federationNodeEndpoint: "节点端点",
    federationNodeDesc: "节点描述",
    federationNodeTrust: "信任权重",
    federationAddBtn: "注册节点",
    federationNodeAdded: "节点已注册",
    federationNodeAddError: "节点注册失败",
    federationNodeActive: "活跃",
    federationNodeInactive: "停用",
    federationNodeSuspended: "已挂起",
    federationLastSeen: "上次同步",
    federationCapCount: "能力数",
    federationToggle: "联邦",
  },

  en: {
    // Hero
    subtitle:
      "Capability Commensurability Network — Discover, evaluate, and invoke any capability",

    // Search
    searchPlaceholder:
      "Describe the capability you need, e.g., extract PDF tables",
    searchHint:
      "Enter natural language description to match capability anchors",
    searching: "Searching semantically…",

    // Category
    categoryAll: "All",
    categoryAI: "AI",
    categoryData: "Data",
    categoryMedia: "Media",
    categoryLanguage: "Language",
    categoryDev: "Dev Tools",

    // Empty / Loading
    empty: "No matching capability anchors found",
    emptySub: "Try different keywords or switch category filter",
    noData: "No capability data available",
    loading: "Loading capabilities…",

    // Card
    calls: "calls",

    // Modal
    desc: "Description",
    input: "Input Parameters",
    output: "Output Promise",
    endpoint: "Endpoint",
    provenance: "Provenance",
    trust: "Trust Vector",
    source: "Source Verified",
    usage: "Usage Trace",
    success: "Success Rate",
    risk: "Dependency Risk",
    time: "Timeliness",
    usageGuide: "Usage Guide",
    features: "Features",
    codeExample: "Code Example",

    // Evidence
    evidenceCount: "Based on {n} calls",
    uncertainty: "Uncertainty",
    newCapability: "New",

    // Routing
    routing: "Routing",
    generateCode: "Generate Code",
    tryIt: "Try It",
    exportAdapter: "Export Adapter",
    exportTo: "Export to",
    exportDSH: "DeepSeek-Harness (plugin.yaml)",
    exportMCP: "MCP Client (mcp.json)",
    exportLangChain: "LangChain (Tool JSON)",
    exportCrewAI: "CrewAI (Tool Schema)",
    exportDify: "Dify (Tool Config)",
    exportSelected: "Export Selected",
    copyAll: "Copy All",
    copyCode: "Copy Code",
    codeCopied: "Copied to clipboard",
    tryItTitle: "Browser Try-It",
    tryItMethod: "Method",
    tryItParams: "Parameters",
    tryItHeaders: "Headers",
    tryItSend: "Send Request",
    tryItResponse: "Response",
    tryItStatus: "Status",
    tryItTime: "Time",
    tryItError: "Request Failed",
    tryItOnlyHttp: "Only HTTP endpoints are supported",
    dshInstallHint: "Run the following in DeepSeek-Harness to install",
    dshCliInstall: "Install via CLI",
    dshUrlInstall: "Install via URL",
    dshAdapterGenerated: "DSH adapter config generated",

    // Auth
    login: "Login",
    logout: "Logout",
    loginAs: "Logged in as {name}",
    authLoading: "Verifying…",

    // Federation
    federation: "Federation",
    federatedSearch: "Include federated nodes",
    federatedSource: "Federated",
    federationNodes: "Known Nodes",
    federationNoNodes: "No federated nodes",
    federationAddNode: "Add Node",
    federationNodeId: "Node ID",
    federationNodeName: "Node Name",
    federationNodeEndpoint: "Node Endpoint",
    federationNodeDesc: "Description",
    federationNodeTrust: "Trust Weight",
    federationAddBtn: "Register Node",
    federationNodeAdded: "Node registered",
    federationNodeAddError: "Failed to register node",
    federationNodeActive: "Active",
    federationNodeInactive: "Inactive",
    federationNodeSuspended: "Suspended",
    federationLastSeen: "Last Seen",
    federationCapCount: "Capabilities",
    federationToggle: "Federation",
  },

  ja: {
    subtitle: "能力通約ネットワーク — あらゆる能力を発見・評価・呼び出し",

    searchPlaceholder: "必要な能力を説明してください（例：PDFテーブル抽出）",
    searchHint:
      "自然言語で説明すると、能力アンカーをリアルタイムでマッチングします",
    searching: "意味検索中…",

    categoryAll: "すべて",
    categoryAI: "AI",
    categoryData: "データ処理",
    categoryMedia: "メディア処理",
    categoryLanguage: "言語サービス",
    categoryDev: "開発ツール",

    empty: "一致する能力アンカーが見つかりません",
    emptySub: "キーワードを変更するか、カテゴリフィルターを切り替えてください",
    noData: "能力データがありません",
    loading: "能力データを読み込み中…",

    calls: "回の呼び出し",

    desc: "説明",
    input: "入力パラメータ",
    output: "出力保証",
    endpoint: "エンドポイント",
    provenance: "ソースリンク",
    trust: "信頼ベクトル",
    source: "ソース検証",
    usage: "使用実績",
    success: "成功率",
    risk: "依存リスク",
    time: "鮮度",
    usageGuide: "使用ガイド",
    features: "機能",
    codeExample: "コード例",

    evidenceCount: "{n}回の呼び出しに基づく",
    uncertainty: "不確実性",
    newCapability: "新機能",

    routing: "ルーティング",
    generateCode: "コード生成",
    tryIt: "ブラウザで試す",
    exportAdapter: "アダプターをエクスポート",
    exportTo: "エクスポート先",
    exportDSH: "DeepSeek-Harness (plugin.yaml)",
    exportMCP: "MCP クライアント (mcp.json)",
    exportLangChain: "LangChain (Tool JSON)",
    exportCrewAI: "CrewAI (Tool Schema)",
    exportDify: "Dify (ツール設定)",
    exportSelected: "選択をエクスポート",
    copyAll: "すべてコピー",
    copyCode: "コードをコピー",
    codeCopied: "クリップボードにコピーしました",
    tryItTitle: "ブラウザで試す",
    tryItMethod: "メソッド",
    tryItParams: "パラメータ",
    tryItHeaders: "ヘッダー",
    tryItSend: "リクエスト送信",
    tryItResponse: "レスポンス",
    tryItStatus: "ステータスコード",
    tryItTime: "所要時間",
    tryItError: "リクエスト失敗",
    tryItOnlyHttp: "HTTPエンドポイントのみ対応",
    dshInstallHint: "DeepSeek-Harness環境で以下を実行してインストール",
    dshCliInstall: "CLIでインストール",
    dshUrlInstall: "URLでインストール",
    dshAdapterGenerated: "DSHアダプター設定が生成されました",

    // Auth
    login: "ログイン",
    logout: "ログアウト",
    loginAs: "{name} としてログイン中",
    authLoading: "検証中…",

    // Federation
    federation: "連邦ネットワーク",
    federatedSearch: "連邦ノードを含める",
    federatedSource: "連邦",
    federationNodes: "既知のノード",
    federationNoNodes: "連邦ノードがありません",
    federationAddNode: "ノードを追加",
    federationNodeId: "ノードID",
    federationNodeName: "ノード名",
    federationNodeEndpoint: "ノードエンドポイント",
    federationNodeDesc: "説明",
    federationNodeTrust: "信頼重み",
    federationAddBtn: "ノードを登録",
    federationNodeAdded: "ノードを登録しました",
    federationNodeAddError: "ノード登録に失敗しました",
    federationNodeActive: "アクティブ",
    federationNodeInactive: "非アクティブ",
    federationNodeSuspended: "停止中",
    federationLastSeen: "最終同期",
    federationCapCount: "能力数",
    federationToggle: "連邦",
  },
};
