   
                                   

     
                                                                                        
                                                        
                                      
                                                                             
                                                                                            

                          
                                                                                       
                                                                                           
                                                                                                         
   

import customtkinter as ctk
import threading
import requests

SERVER_URL = "http://127.0.0.1:5000/api/console"                                     


class Console(ctk.CTkFrame):
    def __init__(self, master, **kwargs):
        super().__init__(master, **kwargs)

        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=1)

                                      
        self.output = ctk.CTkTextbox(
            self,
            font=("Consolas", 13),
            fg_color="#1a1a1a",
            text_color="#d4d4d4",
            wrap="word",
        )
        self.output.grid(row=0, column=0, sticky="nsew", padx=6, pady=(6, 3))
        self.output.configure(state="disabled")                                 

                                                
        self.output.tag_config("cmd", foreground="#4fc3f7")
        self.output.tag_config("resp", foreground="#d4d4d4")
        self.output.tag_config("err", foreground="#ef5350")

                            
        self.entry = ctk.CTkEntry(
            self,
            font=("Consolas", 13),
            fg_color="#0f0f0f",
            border_color="#333333",
            text_color="#ffffff",
            placeholder_text="введите команду...",
        )
        self.entry.grid(row=1, column=0, sticky="ew", padx=6, pady=(3, 6))
        self.entry.bind("<Return>", self.on_enter)
        self.entry.bind("<Up>", self.history_up)
        self.entry.bind("<Down>", self.history_down)

                                                           
        self.cmd_history = []
        self.history_index = -1

                                                  
    def print_line(self, text, tag="resp"):
        self.output.configure(state="normal")
        self.output.insert("end", text + "\n", tag)
        self.output.configure(state="disabled")
        self.output.see("end")                   

                                           
    def on_enter(self, event=None):
        command = self.entry.get().strip()
        if not command:
            return

        self.print_line(f"] {command}", tag="cmd")
        self.entry.delete(0, "end")

                                    
        self.cmd_history.append(command)
        self.history_index = len(self.cmd_history)

                                                                       
        threading.Thread(target=self.send_to_server, args=(command,), daemon=True).start()

    def history_up(self, event=None):
        if not self.cmd_history:
            return
        self.history_index = max(0, self.history_index - 1)
        self.entry.delete(0, "end")
        self.entry.insert(0, self.cmd_history[self.history_index])

    def history_down(self, event=None):
        if not self.cmd_history:
            return
        self.history_index = min(len(self.cmd_history), self.history_index + 1)
        self.entry.delete(0, "end")
        if self.history_index < len(self.cmd_history):
            self.entry.insert(0, self.cmd_history[self.history_index])

                                          
    def send_to_server(self, command):
        try:
            r = requests.post(SERVER_URL, json={"command": command}, timeout=5)
            r.raise_for_status()
            data = r.json()
            output = data.get("output", "(пустой ответ)")
                                                                   
            self.after(0, lambda: self.print_line(output, tag="resp"))
        except Exception as e:
            self.after(0, lambda: self.print_line(f"Ошибка: {e}", tag="err"))


                                                      
if __name__ == "__main__":
    ctk.set_appearance_mode("dark")

    app = ctk.CTk()
    app.title("Console")
    app.geometry("700x400")
    app.grid_rowconfigure(0, weight=1)
    app.grid_columnconfigure(0, weight=1)

    console = Console(app, fg_color="#141414")
    console.grid(row=0, column=0, sticky="nsew")

    app.mainloop()