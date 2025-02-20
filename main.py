from fasthtml.common import *

app, rt = fast_app(pico=False)

static_path = '.'
reg_re_param("xtra", "_hs|wgsl")


@rt
def index():
    return FileResponse("test.html")


async def file_resp(fname: str, ext: str):
    cache_age = 60 * 60 * 24 * 7 if 'media' in fname else 10 * 60
    return FileResponse(f'{static_path}/{fname}.{ext}', headers={'Cache-Control': f'public, max-age={cache_age}'})

app.route("/{fname:path}.{ext:static}")(file_resp)
app.route("/{fname:path}.{ext:xtra}")(file_resp)

serve()
