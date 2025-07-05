from fastapi import FastAPI
from pydantic import BaseModel
from paddlenlp.transformers import ErnieTokenizer, ErnieModel
import paddle

app = FastAPI()

tokenizer = ErnieTokenizer.from_pretrained('ernie-3.0-base-zh')
model = ErnieModel.from_pretrained('ernie-3.0-base-zh')

class InputText(BaseModel):
    text: str

@app.post("/embed")
def embed(input: InputText):
    inputs = tokenizer(input.text, return_tensors="pd", max_seq_len=128, padding=True)
    with paddle.no_grad():
        output = model(**inputs)
    embedding = output[0][:, 0, :].numpy().tolist()[0]
    return {"embedding": embedding}
