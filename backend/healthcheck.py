import sys

if __name__ == "__main__":
    try:
        with open("health.status") as f:
            n = int(f.read())
            sys.exit(n)
    except Exception:
        sys.exit(1) # unhealthy