# CCP LangChain Tool

将 CCP 协议能力锚点封装为 LangChain Tool。

## 5 分钟快速开始

```python
from ccp_langchain import CCPToolkit
from langchain_openai import ChatOpenAI
from langchain.agents import create_openai_functions_agent, AgentExecutor

tools = CCPToolkit().get_tools()
llm = ChatOpenAI(model="gpt-4")
agent = create_openai_functions_agent(llm, tools, "You are a helpful assistant.")
executor = AgentExecutor(agent=agent, tools=tools, verbose=True)
result = executor.invoke({"input": "搜索 PDF 相关的 AI 能力"})
print(result)
```

## 安装

```bash
pip install langchain-core pydantic
# 可选（运行 Agent 示例）：
pip install langchain langchain-openai openai
```

## 工具

| 工具 | 说明 |
| --- | --- |
| `ccp_search` | 搜索 CCP 协议能力锚点（含信任评分摘要） |
| `ccp_detail` | 获取指定能力锚点的完整详情与调用端点 |

端点默认 `https://skillmesh.礼字号.中国/api/ccp/v1`，可通过 `CCPToolkit(base_url=...)` 指向自建/联邦节点。
