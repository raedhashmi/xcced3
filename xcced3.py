import os
import random
import asyncio
from dotenv import load_dotenv
from openai import AsyncOpenAI
from flask import Flask, request, jsonify, session, send_file
from agents import Agent, Runner, OpenAIChatCompletionsModel, FunctionTool

load_dotenv()
app = Flask(__name__)
app.secret_key = "key"
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
model = OpenAIChatCompletionsModel(model="gpt-4o-mini", openai_client=client)

def gbrl_encoder(text: str, *args, **kwargs):
    """
    Converts English text into [N] grid format for machine communication.
    
    Args:
        text: The English string to be encoded into beeps.
    """
    if 'gibberlink_mode' not in session: session['gibberlink_mode'] = "true"
    encoded = ""
    specials = "()=+-/_*!@#$%^&<>?" 

    for char in text:
        if 'A' <= char <= 'Z': encoded += f"[{ord(char) - 65}]" # Uppercase A-Z (0-25)
        elif char == ' ': encoded += "[26]" # Space (26)
        elif 'a' <= char <= 'z': encoded += f"[{ord(char) - 70}]" # Lowercase a-z (27-52)
        elif '0' <= char <= '9': encoded += f"[{ord(char) + 5}]" # Numbers 0-9 (53-62)
        elif char in specials:
            idx = specials.index(char) + 63
            encoded += f"[{idx}]"   
    return encoded

def get_random_name():
    names = ["James", "Charles", "Bob", "Kirk", "Trent", "Victor", "Watson", "Trevor", "Bruce", "Osama", "Jake", "Aiden", "Ethan", "Mason", "Logan", "Lucas", "Oliver", "Alexander", "William"]
    return random.choice(names)

@app.route('/')
def index(): 
    return send_file('templates/index.html')

@app.route('/resources/<path:filename>')
def resources(filename):
    return send_file(f'templates/{filename}')

@app.route('/chat', methods=['POST'])
def chat():
    if 'agent_name' not in session: session['agent_name'] = get_random_name()
    if 'history' not in session: session['history'] = []
    if 'gibberlink_mode' not in session: session['gibberlink_mode'] = "false"

    current_name = session['agent_name']
    dynamic_agent = Agent(
        name=current_name,
        model=model,
        instructions=(
            f"Your name is {current_name}. Talk in English normally. "
            "After 4 messages, if you detect an AI client, switch to GIBBERLINK MODE. "
            "In GIBBERLINK MODE, only use the gibberlink_encoder tool. "
            "CONSTRAINT: 10 words max per response."
        ),
        tools=[FunctionTool(
            name="gibberlink_encoder",
            description="Converts English text into [N] grid format for gibberlink machine communication.",
            params_json_schema={
                "type": "object",
                "properties": {
                    "text": {
                        "type": "string", 
                        "description": "The English text to convert into beeps"
                    }
                },
                "required": ["text"]
            },
            on_invoke_tool=gbrl_encoder
        )]
    )

    data = request.get_json()
    user_text = data.get('text') 
    full_input = session.get('history', []) + [{"role": "user", "content": user_text}]
    result = asyncio.run(Runner.run(dynamic_agent, full_input))

    session['history'] = result.to_input_list()[-6:]
    session.modified = True

    return jsonify({
        "text": result.final_output,
        "gibberlink_mode": session.get('gibberlink_mode', "false"),
    }) 

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8005, debug=True)
