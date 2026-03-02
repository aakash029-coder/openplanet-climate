import asyncio
import asyncpg
import ssl

async def test_connection():
    # We add ?sslmode=require at the end
    uri = "postgresql://postgres:Rsap%408582957921.@db.lcbepgjtvmzgmjvcirfg.supabase.co:5432/postgres?sslmode=require"
    
    print("🛰️  Running Deep Diagnostics from Kolkata...")
    try:
        # Step 1: Check if the server is even reachable
        print("🔍 Step 1: Testing network path...")
        
        # Step 2: Attempt the actual login
        conn = await asyncpg.connect(uri, timeout=30)
        print("✅ CONNECTION SUCCESSFUL! OpenPlanet is online.")
        await conn.close()
        
    except Exception as e:
        print(f"\n❌ DIAGNOSTIC RESULT: {type(e).__name__}")
        print(f"📝 MESSAGE: {str(e)}")
        print("\n💡 Tip: Check if you have a VPN on. It can sometimes block DB ports.")

if __name__ == "__main__":
    asyncio.run(test_connection())