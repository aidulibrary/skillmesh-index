/* ============================================================
   SkillMesh / 插台 — Internationalization (i18n)
   ============================================================ */

const I18N = {
  zh: {
    // --- Landing Page ---
    // Nav
    navHome: "首页",
    navQuickstart: "快速开始",
    navExplore: "能力探索",
    navApiDocs: "API 文档",
    navHealth: "健康面板",
    navAbout: "关于",
    // Hero
    heroBadge: "🚀 CCP 协议 v1.0 · 联邦网络已就绪",
    heroTitlePart1: "让 AI Agent 像调用函数一样",
    heroTitlePart2: "发现和使用",
    heroTitleHighlight: "任意能力",
    heroSubtitle:
      "CCP（能力通约协议）试图回答一个问题：AI Agent 如何在成千上万个能力中，找到真正靠谱的那一个？我们正在用联邦共识 + 真实调用数据，验证这个假设。",
    heroBtnQuick: "⚡ 5 分钟快速开始",
    heroBtnPlayground: "🔍 在线体验 Playground",
    heroStatCap: "能力锚点",
    heroStatNode: "联邦节点",
    heroStatContrib: "贡献者",
    heroStatTelem: "调用记录",
    // Quick Start
    quickstartTitle: "三步接入，立即可用",
    quickstartDesc:
      "不管你是开发者、Agent 使用者，还是低代码玩家，都能在 5 分钟内跑通第一条调用。",
    step1Title: "搜索能力",
    step1Desc: "用自然语言搜索你需要的 AI 能力——PDF 解析、代码解释、翻译、数学计算……",
    step1Link: "在线试试 →",
    step2Title: "获取适配器",
    step2Desc: "一键生成你所用框架的调用代码：LangChain Tool、MCP Server、DSH Plugin……",
    step2Link: "查看示例 →",
    step3Title: "注册你的能力",
    step3Desc: "把你的 AI 能力贡献给联邦网络，让全球 Agent 都能发现和调用。",
    step3Link: "查看教程 →",
    // For Whom
    forWhomTitle: "无论是谁，都能找到入口",
    forWhomDesc: "CCP 为不同角色设计了不同的接入路径，总有一条适合你。",
    forWhomDevTitle: "我是开发者",
    forWhomDevDesc: "我写代码，想给我的 Agent 接入更多能力，或者发布自己的 AI 服务。",
    forWhomUserTitle: "我是 Agent 使用者",
    forWhomUserDesc: "我用 Dify、Coze 等低代码平台搭建 Agent，想拖拽式接入更多能力。",
    // Ecosystem
    ecoTitle: "CCP 在 Agent 协议生态中的位置",
    ecoDesc:
      "CCP 不替代 MCP、A2A 或 Agent Skills——它做的是这三者都没做的事：能力信任。",
    ecoNote: "CCP 已适配 LangChain · MCP · DSH，Dify 插件即将上线",
    ecoTagCCP: "SkillMesh · 能力信任",
    // Frameworks
    frameworksTitle: "已支持的框架",
    frameworksDesc: "CCP 协议提供 4 条集成通道，覆盖主流 Agent 框架。",
    // About
    aboutTitle: "关于插台与 CCP",
    aboutDesc: "这是一个正在进行的开放实验，我们诚实地告诉你当前的状态。",
    aboutVerifyTitle: "🧪 我们正在验证什么",
    aboutVerifyDesc:
      "CCP 试图回答一个问题：AI Agent 如何在成千上万个能力中，找到真正靠谱的那一个？",
    aboutVerifyMore:
      "我们假设：基于联邦共识 + 真实调用数据，可以计算出每个能力的“信任向量”——而不需要依赖任何单一平台的背书。",
    aboutNotTitle: "📐 CCP 不是什么",
    aboutNotDesc:
      "CCP 不替代 MCP（连接工具），也不替代 A2A（Agent 通信），更不替代 Agent Skills（能力描述）。",
    aboutNotMore: "它做的是这三者都没做的事：能力信任。谁来告诉 Agent 哪个能力真的靠谱？",
    aboutFederationTitle: "🔗 联邦治理",
    aboutFederationDesc:
      "CCP 不是一个公司产品，而是一个联邦协议。任何节点都可以加入联邦网络，共同参与：",
    aboutMoreTitle: "📖 了解更多",
    // Bottom CTA
    ctaTitle: "准备好让你的 Agent 更聪明了吗？",
    ctaDesc: "5 分钟，从零到第一条能力调用。不写代码也能玩。",
    ctaBtn: "🔍 探索能力锚点",
    // Footer
    footerTagline: "插台 SkillMesh · CCP v1.0 · 联邦 · 开源 · 信任实验",
    // Explore Divider
    exploreTitle: "🔍 探索能力锚点",
    exploreDesc: "在下方搜索栏中输入自然语言描述，实时匹配联邦网络中的能力锚点",
    // Theme Toggle
    themeToggle: "切换主题",

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
    // --- Landing Page ---
    // Nav
    navHome: "Home",
    navQuickstart: "Quick Start",
    navExplore: "Explore",
    navApiDocs: "API Docs",
    navHealth: "Health",
    navAbout: "About",
    // Hero
    heroBadge: "🚀 CCP Protocol v1.0 · Federation Ready",
    heroTitlePart1: "Let AI Agents Discover and Use",
    heroTitlePart2: "",
    heroTitleHighlight: "Any Capability",
    heroSubtitle:
      "CCP (Capability Commensuration Protocol) tries to answer one question: how can AI agents find the truly reliable one among thousands of capabilities? We are testing this hypothesis with federated consensus + real invocation data.",
    heroBtnQuick: "⚡ 5-Min Quick Start",
    heroBtnPlayground: "🔍 Try Playground",
    heroStatCap: "Capabilities",
    heroStatNode: "Federation Nodes",
    heroStatContrib: "Contributors",
    heroStatTelem: "Telemetry",
    // Quick Start
    quickstartTitle: "Three Steps to Get Started",
    quickstartDesc:
      "Whether you're a developer, Agent user, or low-code enthusiast, you can run your first call in 5 minutes.",
    step1Title: "Search Capabilities",
    step1Desc: "Use natural language to search for AI capabilities—PDF parsing, code explanation, translation, math...",
    step1Link: "Try it online →",
    step2Title: "Get Adapter",
    step2Desc: "One-click generate call code for your framework: LangChain Tool, MCP Server, DSH Plugin...",
    step2Link: "View example →",
    step3Title: "Register Your Capability",
    step3Desc: "Contribute your AI capability to the federation network so global Agents can discover and invoke it.",
    step3Link: "View tutorial →",
    // For Whom
    forWhomTitle: "An Entry Point for Everyone",
    forWhomDesc: "CCP designs different access paths for different roles—there's always one that fits you.",
    forWhomDevTitle: "I'm a Developer",
    forWhomDevDesc: "I write code and want to give my Agent more capabilities, or publish my own AI services.",
    forWhomUserTitle: "I'm an Agent User",
    forWhomUserDesc: "I build agents with Dify, Coze, and other low-code platforms, and want drag-and-drop access to more capabilities.",
    // Ecosystem
    ecoTitle: "CCP in the Agent Protocol Ecosystem",
    ecoDesc:
      "CCP does not replace MCP, A2A, or Agent Skills—it does what none of them do: capability trust.",
    ecoNote: "CCP adapts to LangChain · MCP · DSH, Dify plugin coming soon",
    ecoTagCCP: "SkillMesh · Capability Trust",
    // Frameworks
    frameworksTitle: "Supported Frameworks",
    frameworksDesc: "CCP protocol provides 4 integration channels covering mainstream Agent frameworks.",
    // About
    aboutTitle: "About SkillMesh & CCP",
    aboutDesc: "This is an ongoing open experiment. We honestly tell you the current state.",
    aboutVerifyTitle: "🧪 What We're Testing",
    aboutVerifyDesc:
      "CCP tries to answer one question: how can AI agents find the truly reliable one among thousands of capabilities?",
    aboutVerifyMore:
      "Our hypothesis: based on federated consensus + real invocation data, we can compute a \"trust vector\" for each capability—without relying on any single platform's endorsement.",
    aboutNotTitle: "📐 What CCP Is Not",
    aboutNotDesc:
      "CCP does not replace MCP (tool connection), nor A2A (Agent communication), nor Agent Skills (capability description).",
    aboutNotMore: "It does what none of them do: capability trust. Who tells the Agent which capability is truly reliable?",
    aboutFederationTitle: "🔗 Federation Governance",
    aboutFederationDesc:
      "CCP is not a company product, but a federation protocol. Any node can join the federation network and participate in:",
    aboutMoreTitle: "📖 Learn More",
    // Bottom CTA
    ctaTitle: "Ready to Make Your Agent Smarter?",
    ctaDesc: "5 minutes, from zero to first capability call. No coding required.",
    ctaBtn: "🔍 Explore Capabilities",
    // Footer
    footerTagline: "SkillMesh · CCP v1.0 · Federation · Open Source · Trust Experiment",
    // Explore Divider
    exploreTitle: "🔍 Explore Capability Anchors",
    exploreDesc: "Enter natural language descriptions below to match capability anchors in the federation network in real time",
    // Theme Toggle
    themeToggle: "Toggle Theme",

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
    // --- Landing Page ---
    // Nav
    navHome: "ホーム",
    navQuickstart: "クイックスタート",
    navExplore: "探索",
    navApiDocs: "API ドキュメント",
    navHealth: "ヘルス",
    navAbout: "概要",
    // Hero
    heroBadge: "🚀 CCP プロトコル v1.0 · 連邦ネットワーク準備完了",
    heroTitlePart1: "AIエージェントが関数のように",
    heroTitlePart2: "",
    heroTitleHighlight: "あらゆる能力",
    heroSubtitle:
      "CCP（能力通約プロトコル）は問いかける：AIエージェントは何千もの能力の中から、本当に信頼できるものを見つけられるのか？私たちは連邦コンセンサス＋実呼び出しデータでこの仮説を検証している。",
    heroBtnQuick: "⚡ 5分でクイックスタート",
    heroBtnPlayground: "🔍 プレイグラウンドを試す",
    heroStatCap: "能力アンカー",
    heroStatNode: "連邦ノード",
    heroStatContrib: "貢献者",
    heroStatTelem: "呼び出し記録",
    // Quick Start
    quickstartTitle: "3ステップですぐに使える",
    quickstartDesc:
      "開発者、Agentユーザー、ローコードユーザー問わず、5分で最初の呼び出しを実行できます。",
    step1Title: "能力を検索",
    step1Desc: "自然言語で必要なAI能力を検索—PDF解析、コード説明、翻訳、数学計算…",
    step1Link: "オンラインで試す →",
    step2Title: "アダプターを取得",
    step2Desc: "お使いのフレームワーク用のコードをワンクリック生成：LangChain Tool、MCP Server、DSH Plugin…",
    step2Link: "例を見る →",
    step3Title: "あなたの能力を登録",
    step3Desc: "あなたのAI能力を連邦ネットワークに貢献し、世界中のAgentが発見・呼び出せるように。",
    step3Link: "チュートリアルを見る →",
    // For Whom
    forWhomTitle: "誰でも参加できる入口",
    forWhomDesc: "CCPは様々な役割に合わせたアクセスパスを設計しています。必ずあなたに合ったものがあります。",
    forWhomDevTitle: "私は開発者です",
    forWhomDevDesc: "コードを書いて、Agentにもっと多くの能力を追加したい、または自分のAIサービスを公開したい。",
    forWhomUserTitle: "私はAgentユーザーです",
    forWhomUserDesc: "Dify、CozeなどのローコードプラットフォームでAgentを構築し、より多くの能力をドラッグ＆ドロップで追加したい。",
    // Ecosystem
    ecoTitle: "AgentプロトコルエコシステムにおけるCCPの位置",
    ecoDesc:
      "CCPはMCP、A2A、Agent Skillsを代替するものではなく、これら三者がやっていないことを行う：能力の信頼。",
    ecoNote: "CCPはLangChain・MCP・DSHに対応、Difyプラグインは近日公開",
    ecoTagCCP: "SkillMesh · 能力信頼",
    // Frameworks
    frameworksTitle: "対応フレームワーク",
    frameworksDesc: "CCPプロトコルは4つの統合チャネルを提供し、主要なAgentフレームワークをカバーします。",
    // About
    aboutTitle: "SkillMesh & CCPについて",
    aboutDesc: "これは進行中のオープンな実験です。現在の状態を正直にお伝えします。",
    aboutVerifyTitle: "🧪 検証していること",
    aboutVerifyDesc:
      "CCPは問いかける：AIエージェントは何千もの能力の中から、本当に信頼できるものを見つけられるのか？",
    aboutVerifyMore:
      "私たちの仮説：連邦コンセンサス＋実呼び出しデータに基づいて、各能力の「信頼ベクトル」を計算できる—単一プラットフォームの保証に依存せずに。",
    aboutNotTitle: "📐 CCPではないもの",
    aboutNotDesc:
      "CCPはMCP（ツール接続）を代替せず、A2A（Agent通信）も、Agent Skills（能力記述）も代替しません。",
    aboutNotMore: "これら三者がやっていないことを行う：能力の信頼。どの能力が本当に信頼できるかをAgentに伝えるのは誰か？",
    aboutFederationTitle: "🔗 連邦ガバナンス",
    aboutFederationDesc:
      "CCPは企業製品ではなく、連邦プロトコルです。どのノードも連邦ネットワークに参加し、以下に共同参加できます：",
    aboutMoreTitle: "📖 さらに詳しく",
    // Bottom CTA
    ctaTitle: "あなたのAgentをもっと賢くする準備はできましたか？",
    ctaDesc: "5分で、ゼロから最初の能力呼び出しまで。コーディング不要でも遊べます。",
    ctaBtn: "🔍 能力アンカーを探索",
    // Footer
    footerTagline: "SkillMesh · CCP v1.0 · 連邦 · オープンソース · 信頼実験",
    // Explore Divider
    exploreTitle: "🔍 能力アンカーを探索",
    exploreDesc: "下の検索バーに自然言語で説明を入力すると、連邦ネットワーク内の能力アンカーをリアルタイムでマッチングします",
    // Theme Toggle
    themeToggle: "テーマ切替",

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