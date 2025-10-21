#!/usr/bin/env python3
"""
openWakeWord Service
Runs wake word detection and communicates with Electron via stdout/stdin
"""

import sys
import json
import pyaudio
import numpy as np
from openwakeword.model import Model
import threading
import time
import os

# Audio configuration
CHUNK_SIZE = 1280  # 80ms at 16kHz
FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE = 16000

class WakeWordService:
    def __init__(self):
        self.model = None
        self.audio = None
        self.stream = None
        self.running = False
        self.thread = None
        
    def log(self, message):
        """Send log message to Electron"""
        print(json.dumps({"type": "log", "message": message}), flush=True)
        
    def send_detection(self, wake_word):
        """Send wake word detection to Electron"""
        print(json.dumps({"type": "detection", "wakeWord": wake_word}), flush=True)
        
    def send_error(self, error):
        """Send error to Electron"""
        print(json.dumps({"type": "error", "error": str(error)}), flush=True)
        
    def initialize(self, models_dir=None):
        """Initialize the wake word model"""
        try:
            self.log("Initializing openWakeWord...")

            # Check for custom model first
            custom_model_path = "openwakeword_models/okay_panel-final.onnx"

            if os.path.exists(custom_model_path):
                self.log(f"Found custom model: {custom_model_path}")
                self.log("Loading 'Okay Panel' wake word model...")
                self.model = Model(
                    wakeword_models=[custom_model_path],
                    inference_framework='onnx'
                )
            else:
                # Fallback to default model
                self.log("Custom model not found, using default 'hey mycroft'")
                self._download_models()
                self.log("Loading wake word models...")
                self.model = Model(
                    wakeword_models=["hey_mycroft_v0.1"],
                    inference_framework='onnx'
                )

            self.log(f"Loaded models: {list(self.model.models.keys())}")

            # Initialize PyAudio
            self.audio = pyaudio.PyAudio()

            self.log("openWakeWord initialized successfully")
            return True

        except Exception as e:
            self.send_error(f"Failed to initialize: {e}")
            import traceback
            self.send_error(traceback.format_exc())
            return False

    def _download_models(self):
        """Download models if they don't exist"""
        try:
            from openwakeword import utils

            # Download hey_mycroft model
            model_name = "hey_mycroft_v0.1"
            self.log(f"Checking for model: {model_name}")

            # This will download the model if it doesn't exist
            model_path = utils.download_models([model_name])
            self.log(f"Model ready at: {model_path}")

        except Exception as e:
            self.log(f"Note: {e} (will try to load anyway)")
            
    def start_listening(self):
        """Start listening for wake words"""
        if self.running:
            self.log("Already listening")
            return
            
        try:
            # Open audio stream
            self.stream = self.audio.open(
                format=FORMAT,
                channels=CHANNELS,
                rate=RATE,
                input=True,
                frames_per_buffer=CHUNK_SIZE
            )
            
            self.running = True
            self.thread = threading.Thread(target=self._listen_loop)
            self.thread.daemon = True
            self.thread.start()
            
            self.log("Started listening for wake words")
            
        except Exception as e:
            self.send_error(f"Failed to start listening: {e}")
            
    def stop_listening(self):
        """Stop listening for wake words"""
        self.running = False
        
        if self.stream:
            self.stream.stop_stream()
            self.stream.close()
            self.stream = None
            
        if self.thread:
            self.thread.join(timeout=1.0)
            self.thread = None
            
        self.log("Stopped listening")
        
    def _listen_loop(self):
        """Main listening loop"""
        try:
            while self.running:
                # Read audio chunk
                audio_data = self.stream.read(CHUNK_SIZE, exception_on_overflow=False)
                audio_array = np.frombuffer(audio_data, dtype=np.int16)
                
                # Get predictions
                predictions = self.model.predict(audio_array)
                
                # Check for wake word detection
                for wake_word, score in predictions.items():
                    if score > 0.5:  # Threshold for detection
                        self.log(f"Wake word detected: {wake_word} (score: {score:.2f})")
                        self.send_detection(wake_word)
                        
                        # Brief pause after detection to avoid multiple triggers
                        time.sleep(1.0)
                        
        except Exception as e:
            if self.running:  # Only report error if we didn't intentionally stop
                self.send_error(f"Error in listen loop: {e}")
                
    def cleanup(self):
        """Clean up resources"""
        self.stop_listening()
        
        if self.audio:
            self.audio.terminate()
            self.audio = None
            
        self.log("Cleanup complete")

def main():
    """Main entry point"""
    service = WakeWordService()
    
    try:
        # Read commands from stdin
        service.log("openWakeWord service started")
        
        for line in sys.stdin:
            try:
                command = json.loads(line.strip())
                cmd_type = command.get("type")
                
                if cmd_type == "init":
                    models_dir = command.get("modelsDir", "openwakeword_models")
                    success = service.initialize(models_dir)
                    print(json.dumps({"type": "init_response", "success": success}), flush=True)
                    
                elif cmd_type == "start":
                    service.start_listening()
                    print(json.dumps({"type": "start_response", "success": True}), flush=True)
                    
                elif cmd_type == "stop":
                    service.stop_listening()
                    print(json.dumps({"type": "stop_response", "success": True}), flush=True)
                    
                elif cmd_type == "quit":
                    service.log("Received quit command")
                    break
                    
                else:
                    service.send_error(f"Unknown command: {cmd_type}")
                    
            except json.JSONDecodeError as e:
                service.send_error(f"Invalid JSON: {e}")
            except Exception as e:
                service.send_error(f"Error processing command: {e}")
                
    except KeyboardInterrupt:
        service.log("Interrupted by user")
    finally:
        service.cleanup()
        service.log("Service stopped")

if __name__ == "__main__":
    main()

