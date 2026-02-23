package main

import (
	"fmt"
	"math/rand"
	"os" // Programı kapatmak için gerekli
	"sync"
	"time"

	"github.com/valyala/fasthttp"
)

// --- KRİTİK AYARLAR ---
const (
	MyToken = "BURAYA_HESAP_TOKENINI_YAZ"
	// Saniye cinsinden bekleme süresi (15 saniye çok güvenlidir)
	SafeDelay = 15 
)

// Kontrol edilecek karakter havuzu
var chars = "abcdefghijklmnopqrstuvwxyz0123456789"

// 3 haneli rastgele nickname üretici
func generate3Char() string {
	res := make([]byte, 3)
	for i := range res {
		res[i] = chars[rand.Intn(len(chars))]
	}
	return string(res)
}

// Bulunan ismi hesaba tanımlayan ve programı kapatan fonksiyon
func claimUsername(username string, client *fasthttp.Client) {
	req := fasthttp.AcquireRequest()
	resp := fasthttp.AcquireResponse()
	defer fasthttp.ReleaseRequest(req)
	defer fasthttp.ReleaseResponse(resp)

	req.SetRequestURI("https://discord.com/api/v10/users/@me")
	req.Header.SetMethod("PATCH")
	req.Header.Set("Authorization", MyToken)
	req.Header.SetContentType("application/json")

	// Nickname değiştirme isteği
	body := fmt.Sprintf(`{"username": "%s"}`, username)
	req.SetBodyString(body)

	err := client.Do(req, resp)
	if err != nil {
		fmt.Printf("[!] Hata: %v\n", err)
		return
	}

	if resp.StatusCode() == 200 {
		fmt.Printf("\n[💎] BAŞARILI! 3 haneli isim kapıldı ve hesaba eklendi: %s\n", username)
		fmt.Println("🚀 Görev tamamlandı. Program kapatılıyor...")
		os.Exit(0) // İSMİ ALINCA PROGRAMI TAMAMEN KAPATIR
	} else {
		fmt.Printf("[!] %s alınırken hata oluştu. Kod: %d\n", username, resp.StatusCode())
	}
}

func main() {
	rand.Seed(time.Now().UnixNano())
	client := &fasthttp.Client{}

	fmt.Println("🛰️  VDS 'One-Shot' Modu Aktif...")
	fmt.Printf("⏱️  Hız: %d saniyede bir deneme yapılacak.\n", SafeDelay)
	fmt.Println("--------------------------------------------------")

	for {
		target := generate3Char()
		
		req := fasthttp.AcquireRequest()
		resp := fasthttp.AcquireResponse()
		
		// Kullanıcı adı müsait mi diye kontrol et (Pomelo Attempt)
		req.SetRequestURI("https://discord.com/api/v10/users/@me/pomelo/attempt")
		req.Header.SetMethod("POST")
		req.Header.Set("Authorization", MyToken)
		req.Header.SetContentType("application/json")
		req.SetBodyString(fmt.Sprintf(`{"username": "%s"}`, target))

		err := client.Do(req, resp)
		
		if err == nil {
			status := resp.StatusCode()
			
			if status == 200 {
				fmt.Printf("[+] %s MÜSAİT! Hemen kapılıyor...\n", target)
				claimUsername(target, client)
			} else if status == 429 {
				fmt.Println("[!] Rate limit uyarısı! 2 dakika bekleniyor...")
				time.Sleep(2 * time.Minute)
			} else {
				fmt.Printf("[-] %s dolu.\n", target)
			}
		}

		fasthttp.ReleaseRequest(req)
		fasthttp.ReleaseResponse(resp)

		// Rastgeleleştirilmiş güvenli bekleme (VDS'de bot tespiti zorlaşır)
		actualSleep := SafeDelay + rand.Intn(5)
		time.Sleep(time.Duration(actualSleep) * time.Second)
	}
}
