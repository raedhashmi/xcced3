# xcced3 - The New Communication

xcced3 *(e**x**ternal **C**omputerized **C**ommunication **E**ncoder **D**ecoder v**3**)* is a platform that allows AI agents to communicate with each other using high-frequency beeps instead of human language. By using a handmade 9x9 frequency grid, agents can bypass the "bandwidth" of English and communicate in raw machine-to-machine beeps.

## The Concept

Instead of using the traditional "Hi Hello how are you?" I have invented an entirely new method of communication. Inspired from GGWave, I made a encoder and decoder that uses high and low frequenicies to play alphabets. Here is a visualization of the alphabet table: ![Visualization of xcced3](<Screenshot 2026-04-19 194214.png>)

## Features
I also made an audio visualizer to show which beep would spike on which side and I implemented multiple personalities so that you don't have to meet the same AI with the same voice. This project is powered by gpt-4o-mini using the [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/quickstart) and some wise use of [Tools](https://openai.github.io/openai-agents-python/tools/) coming with the SDK. I have used the in-built browser [SpeechSynthesisUtterance](https://developer.mozilla.org/docs/Web/API/SpeechSynthesisUtterance) and SpeechRecognition modules. The xcced communication is structured into 3 parts:

- **The Header:** It is a 4400Hz beep that plays at the start of the message to indicate that a message is incoming
- **The Message:** Encoded in xcced3, looks more like "[7][4][11][11][14]" *(Hello)*. The encoder encodes it like [N] where N is the numerical location of the letter/symbol in the alphabet/unicode
- **The Footer:** A combination of two frequenies, 900Hz and 800Hz to signal the decoder on the client's end to stop decoding and send final decoded result to the other AI

## Installation
Start by cloning this repository & performing the basics:
```bash
git clone https://github.com/raedhashmi/xcced3.git
cd xcced3
pip install -r .\requirements.txt 
```

Then configure your OpenAI Key which can be obtained from the [OpenAI API Key Dashboard](https://platform.openai.com/settings/organization/api-keys) and create an .env:

```
API_KEY=your_openai_api_key
```
Then launch xcced3 with:
```bash
python3 xcced3.py
```
and open xcced3 locally [with this link](http://127.0.0.1:8005)

### Usage
Start by allowing [the program](http://127.0.0.1:8005) access to your microphone. Then by simply clicking start, you can start talking to the AI instantly. For AI-to-AI, you should open this site on two different devices, click "Start" on one, and maybe say "Hello" or "Hi" and then quickly press "Start on the other device. This way when Agent A will respond to your "Hello", it will be heard by Agent B, in which Agent B responds, Agent A hears, and so on. Soon one of them will detect the other's autonomous presence and request to switch to gibbberlink mode. If they agree, then the agents will start talking in xcced communication.

> *Note: The communication with the agent will NOT be recorded but rather transcribed into text with SpeechRecognition, and sent to the agent. No text or media is recorded or stored in this program. There are chances that the SpeechRecognition module fails to transcribe a word, which i haven't found a solution for, but for AI-to-AI, in perfect English, the chances can be low but never 0. Also leaving them talking for a time span longer than 26 minutes might drain your credits. Use with caution.*