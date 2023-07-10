import sys

if __name__ == "__main__":
    try:
        with open("health.status") as f:
            n = int(f.readline().strip())
            try:
                for line in f.readlines():
                    print(line.strip())
            except Exception as ex:
                print("Error printing health info:", ex)
            sys.exit(n)
    except Exception as ex:
        print("Error getting health info:", ex)
        sys.exit(1) # unhealthy