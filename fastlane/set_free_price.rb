require "json"
require "jwt"
require "net/http"
require "openssl"
require "uri"

APP_ID = "6799814601"
API_ROOT = "https://api.appstoreconnect.apple.com"

key_config = JSON.parse(File.read(ARGV.fetch(0)))
now = Time.now.to_i
token = JWT.encode(
  {
    iss: key_config.fetch("issuer_id"),
    iat: now,
    exp: now + 900,
    aud: "appstoreconnect-v1"
  },
  OpenSSL::PKey::EC.new(key_config.fetch("key")),
  "ES256",
  { kid: key_config.fetch("key_id"), typ: "JWT" }
)

def request(token, method, path, body = nil)
  uri = URI.join(API_ROOT, path)
  request_class = method == :get ? Net::HTTP::Get : Net::HTTP::Post
  req = request_class.new(uri)
  req["Authorization"] = "Bearer #{token}"
  req["Content-Type"] = "application/json"
  req.body = JSON.generate(body) if body
  response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) { |http| http.request(req) }
  [response.code.to_i, response.body.empty? ? {} : JSON.parse(response.body)]
end

schedule_status, = request(token, :get, "/v1/apps/#{APP_ID}/appPriceSchedule")
if schedule_status == 200
  puts "An app price schedule already exists; keeping it unchanged."
  exit 0
end

price_path = "/v1/apps/#{APP_ID}/appPricePoints?filter%5Bterritory%5D=USA&fields%5BappPricePoints%5D=customerPrice&include=territory&limit=200"
price_status, price_body = request(token, :get, price_path)
raise "Unable to list App Store price points (HTTP #{price_status})" unless price_status == 200

free_point = price_body.fetch("data").find do |point|
  point.dig("attributes", "customerPrice").to_f.zero?
end
raise "Apple did not return a free USA price point" unless free_point

placeholder = "${newprice-0}"
payload = {
  data: {
    type: "appPriceSchedules",
    attributes: {},
    relationships: {
      app: { data: { type: "apps", id: APP_ID } },
      manualPrices: { data: [{ type: "appPrices", id: placeholder }] },
      baseTerritory: { data: { type: "territories", id: "USA" } }
    }
  },
  included: [
    {
      type: "appPrices",
      id: placeholder,
      attributes: { startDate: nil, endDate: nil },
      relationships: {
        appPricePoint: {
          data: { type: "appPricePoints", id: free_point.fetch("id") }
        }
      }
    }
  ]
}

create_status, create_body = request(token, :post, "/v1/appPriceSchedules", payload)
unless create_status == 201
  details = create_body.fetch("errors", []).map { |error| error["detail"] }.compact.join("; ")
  raise "Unable to set app price to Free (HTTP #{create_status}): #{details}"
end

puts "App Store price successfully set to Free."
