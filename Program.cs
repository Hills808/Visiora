using VisioraAPI.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddControllers();

builder.Services.AddScoped<VisioraService>();
builder.Services.AddScoped<OpenAIService>();
builder.Services.AddScoped<AudioService>();
builder.Services.AddSingleton<AzureSpeechService>();
builder.Services.AddSingleton<MemoriaPersistenteService>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseDefaultFiles();
app.UseStaticFiles();
app.MapControllers();

app.Run();
