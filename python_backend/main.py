import os
import json
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.llms import FakeListLLM
import uuid

app = FastAPI()

# Input Models
class Message(BaseModel):
    role: str
    content: str

class ChatContext(BaseModel):
    filename: str
    content: str

class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    messages: List[Message]
    context: Optional[ChatContext] = None
    model: Optional[str] = "gemini-1.5-flash"

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DRIVE_ROOT = os.path.join(os.getcwd(), "drive_data")
CHATS_DIR = os.path.join(DRIVE_ROOT, ".chats")
os.makedirs(CHATS_DIR, exist_ok=True)

# LLM Setup
def get_llm(model_name="gemini-1.5-flash"):
    api_key = os.getenv("GOOGLE_API_KEY")
    if api_key:
        return ChatGoogleGenerativeAI(model=model_name, temperature=0.7)
    else:
        # Mock LLM 
        return FakeListLLM(responses=[
            f"I'm Think AI (running {model_name} on Mock). I see you don't have a GOOGLE_API_KEY set.",
            "I can help you edit documents or plan your next big idea.",
            "Please check your .env file."
        ])

def load_history(session_id: str) -> List[Message]:
    path = os.path.join(CHATS_DIR, f"{session_id}.json")
    if os.path.exists(path):
        with open(path, "r") as f:
            data = json.load(f)
            return [Message(**m) for m in data]
    return []

def save_history(session_id: str, messages: List[Message]):
    path = os.path.join(CHATS_DIR, f"{session_id}.json")
    with open(path, "w") as f:
        json.dump([m.dict() for m in messages], f)

@app.get("/chats")
async def list_chats():
    chats = []
    if os.path.exists(CHATS_DIR):
        for f in os.listdir(CHATS_DIR):
            if f.endswith(".json"):
                path = os.path.join(CHATS_DIR, f)
                with open(path, "r") as file:
                    try:
                        data = json.load(file)
                        # title is first user message or New Chat
                        title = "New Chat"
                        if len(data) > 0:
                            first_user = next((m for m in data if m['role'] == 'user'), None)
                            if first_user:
                                title = first_user['content'][:30]
                        
                        chats.append({
                            "id": f.replace(".json", ""),
                            "title": title,
                            "updatedAt": os.path.getmtime(path)
                        })
                    except:
                        pass # Skip invalid files
    # Sort by recent
    chats.sort(key=lambda x: x["updatedAt"], reverse=True)
    return {"chats": chats}

@app.get("/chats/{session_id}")
async def get_chat(session_id: str):
    history = load_history(session_id)
    return {"messages": history}

@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    try:
        session_id = req.session_id or str(uuid.uuid4())
        
        # Load existing history if session exists
        history = load_history(session_id)
        
        current_messages = req.messages
        # last_user_msg = current_messages[-1]
        
        # Select Model
        model_name = req.model if req.model in ["gemini-1.5-flash", "gemini-1.5-pro"] else "gemini-1.5-flash"
        llm = get_llm(model_name)
        
        langchain_messages = []
        
        system_prompt = f"You are Think, a helpful AI assistant powered by Google Gemini ({model_name})."
        if req.context:
            system_prompt += f"\n\nUser is discussing the file: {req.context.filename}.\nContent:\n{req.context.content[:10000]}"
            
        langchain_messages.append(SystemMessage(content=system_prompt))
        
        for msg in current_messages:
            if msg.role == 'user':
                langchain_messages.append(HumanMessage(content=msg.content))
            elif msg.role == 'assistant':
                langchain_messages.append(AIMessage(content=msg.content))
        
        response = llm.invoke(langchain_messages)
        content = response.content if hasattr(response, 'content') else str(response)
        
        # Update History
        updated_history = current_messages + [Message(role="assistant", content=content)]
        save_history(session_id, updated_history)
        
        return {"role": "assistant", "content": content, "session_id": session_id}

    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
